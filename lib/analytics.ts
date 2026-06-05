import { getClientIp } from './middleware';
import type { Env } from './types';

type Channel = 'direct' | 'internal' | 'search' | 'referral' | 'social';

export interface AnalyticsViewBody {
  pageId?: string;
  pageTitle?: string;
  pageUrl?: string;
  canonicalUrl?: string;
  referrer?: string;
  referrerDomain?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  channel?: string;
  screen?: {
    width?: number;
    height?: number;
  };
  viewport?: {
    width?: number;
    height?: number;
  };
  deviceType?: string;
  language?: string;
  timezone?: string;
  visitorId?: string;
  sessionId?: string;
}

export interface PageStats {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  canonicalUrl: string;
  views: number;
  visitors: number;
  sessions: number;
  searchViews: number;
  messageCount: number;
}

const CHANNEL_COLUMNS: Record<Channel, string> = {
  direct: 'direct_views',
  internal: 'internal_views',
  search: 'search_views',
  referral: 'referral_views',
  social: 'social_views',
};

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function int(value: unknown, min = 0, max = 100000): number {
  const n = typeof value === 'number' ? Math.floor(value) : 0;
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : 0;
}

function normalizeChannel(value: unknown): Channel {
  return value === 'internal' || value === 'search' || value === 'referral' || value === 'social'
    ? value
    : 'direct';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateFromCreatedAt(createdAt: string | null | undefined): string {
  return createdAt ? createdAt.slice(0, 10) : today();
}

export async function isAnalyticsEnabled(env: Env): Promise<boolean> {
  const config = await env.DB.prepare(
    'SELECT analytics_enabled FROM board_config WHERE id = 1'
  ).first<{ analytics_enabled: number }>();
  return config?.analytics_enabled !== 0;
}

export async function getPageStats(env: Env, pageId: string): Promise<PageStats> {
  const approvedMessageCount = await getApprovedMessageCount(env, pageId);
  const row = await env.DB.prepare(
    `SELECT page_id, page_title, page_url, canonical_url, views, visitors, sessions, search_views, message_count
     FROM analytics_page_totals
     WHERE page_id = ?`
  ).bind(pageId).first<{
    page_id: string;
    page_title: string;
    page_url: string;
    canonical_url: string;
    views: number;
    visitors: number;
    sessions: number;
    search_views: number;
    message_count: number;
  }>();

  if (row) {
    if ((row.message_count || 0) !== approvedMessageCount) {
      await env.DB.prepare(
        `UPDATE analytics_page_totals
         SET message_count = ?, updated_at = datetime('now')
         WHERE page_id = ?`
      ).bind(approvedMessageCount, pageId).run();
    }

    return {
      pageId: row.page_id,
      pageTitle: row.page_title || '',
      pageUrl: row.page_url || '',
      canonicalUrl: row.canonical_url || '',
      views: row.views || 0,
      visitors: row.visitors || 0,
      sessions: row.sessions || 0,
      searchViews: row.search_views || 0,
      messageCount: approvedMessageCount,
    };
  }

  return {
    pageId,
    pageTitle: '',
    pageUrl: '',
    canonicalUrl: '',
    views: 0,
    visitors: 0,
    sessions: 0,
    searchViews: 0,
    messageCount: approvedMessageCount,
  };
}

async function getApprovedMessageCount(env: Env, pageId: string): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM messages WHERE page_id = ? AND status = 'approved'`
  ).bind(pageId).first<{ count: number }>();
  return row?.count || 0;
}

export async function recordPageView(env: Env, request: Request, body: AnalyticsViewBody): Promise<PageStats> {
  const pageId = text(body.pageId, 500);
  const visitorId = text(body.visitorId, 128);
  const sessionId = text(body.sessionId, 128);

  if (!pageId || !visitorId || !sessionId) {
    throw new Error('pageId, visitorId and sessionId are required');
  }

  if (!(await isAnalyticsEnabled(env))) {
    return getPageStats(env, pageId);
  }

  const duplicate = await env.DB.prepare(
    `SELECT id FROM analytics_events
     WHERE page_id = ? AND visitor_id = ? AND created_at >= datetime('now', '-5 seconds')
     LIMIT 1`
  ).bind(pageId, visitorId).first<{ id: number }>();

  if (duplicate) {
    return getPageStats(env, pageId);
  }

  const pageTitle = text(body.pageTitle, 300);
  const pageUrl = text(body.pageUrl, 1000);
  const canonicalUrl = text(body.canonicalUrl, 1000);
  const referrer = text(body.referrer, 1000);
  const referrerDomain = text(body.referrerDomain, 255);
  const utmSource = text(body.utm?.source, 100);
  const utmMedium = text(body.utm?.medium, 100);
  const utmCampaign = text(body.utm?.campaign, 150);
  const channel = normalizeChannel(body.channel);
  const channelColumn = CHANNEL_COLUMNS[channel];
  const date = today();
  const messageCount = await getApprovedMessageCount(env, pageId);

  await env.DB.prepare(
    `INSERT INTO analytics_events (
       page_id, page_title, page_url, canonical_url, referrer, referrer_domain,
       utm_source, utm_medium, utm_campaign, channel, country, device_type,
       screen_width, screen_height, viewport_width, viewport_height,
       language, timezone, ip_address, visitor_id, session_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    pageId,
    pageTitle,
    pageUrl,
    canonicalUrl,
    referrer,
    referrerDomain,
    utmSource,
    utmMedium,
    utmCampaign,
    channel,
    request.headers.get('CF-IPCountry') || '',
    text(body.deviceType, 20),
    int(body.screen?.width),
    int(body.screen?.height),
    int(body.viewport?.width),
    int(body.viewport?.height),
    text(body.language, 50),
    text(body.timezone, 80),
    getClientIp(request),
    visitorId,
    sessionId
  ).run();

  const visitorInsert = await env.DB.prepare(
    'INSERT OR IGNORE INTO analytics_daily_visitors (date, page_id, visitor_id) VALUES (?, ?, ?)'
  ).bind(date, pageId, visitorId).run();

  const sessionInsert = await env.DB.prepare(
    'INSERT OR IGNORE INTO analytics_daily_sessions (date, page_id, session_id) VALUES (?, ?, ?)'
  ).bind(date, pageId, sessionId).run();

  const visitorInc = visitorInsert.meta.changes || 0;
  const sessionInc = sessionInsert.meta.changes || 0;

  await env.DB.prepare(
    `INSERT INTO analytics_page_daily (
       date, page_id, page_title, page_url, canonical_url, views, visitors, sessions, ${channelColumn}, updated_at
     ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, 1, datetime('now'))
     ON CONFLICT(date, page_id) DO UPDATE SET
       page_title = excluded.page_title,
       page_url = excluded.page_url,
       canonical_url = excluded.canonical_url,
       views = analytics_page_daily.views + 1,
       visitors = analytics_page_daily.visitors + ?,
       sessions = analytics_page_daily.sessions + ?,
       ${channelColumn} = ${channelColumn} + 1,
       updated_at = datetime('now')`
  ).bind(date, pageId, pageTitle, pageUrl, canonicalUrl, visitorInc, sessionInc, visitorInc, sessionInc).run();

  await env.DB.prepare(
    `INSERT INTO analytics_page_totals (
       page_id, page_title, page_url, canonical_url, views, visitors, sessions, search_views, message_count, last_view_at, updated_at
     ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(page_id) DO UPDATE SET
       page_title = excluded.page_title,
       page_url = excluded.page_url,
       canonical_url = excluded.canonical_url,
       views = analytics_page_totals.views + 1,
       visitors = analytics_page_totals.visitors + ?,
       sessions = analytics_page_totals.sessions + ?,
       search_views = analytics_page_totals.search_views + ?,
       message_count = max(analytics_page_totals.message_count, excluded.message_count),
       last_view_at = datetime('now'),
       updated_at = datetime('now')`
  ).bind(
    pageId,
    pageTitle,
    pageUrl,
    canonicalUrl,
    visitorInc,
    sessionInc,
    channel === 'search' ? 1 : 0,
    messageCount,
    visitorInc,
    sessionInc,
    channel === 'search' ? 1 : 0
  ).run();

  return getPageStats(env, pageId);
}

export async function adjustMessageCount(
  env: Env,
  pageId: string,
  pageUrl: string,
  createdAt: string | null | undefined,
  delta: number
): Promise<void> {
  if (!pageId || delta === 0) return;

  const date = dateFromCreatedAt(createdAt);

  await env.DB.prepare(
    `INSERT INTO analytics_page_totals (page_id, page_url, message_count, last_message_at, updated_at)
     VALUES (?, ?, max(0, ?), datetime('now'), datetime('now'))
     ON CONFLICT(page_id) DO UPDATE SET
       page_url = CASE WHEN excluded.page_url != '' THEN excluded.page_url ELSE analytics_page_totals.page_url END,
       message_count = max(0, analytics_page_totals.message_count + ?),
       last_message_at = datetime('now'),
       updated_at = datetime('now')`
  ).bind(pageId, pageUrl || '', delta, delta).run();

  await env.DB.prepare(
    `INSERT INTO analytics_page_daily (date, page_id, page_url, message_count, updated_at)
     VALUES (?, ?, ?, max(0, ?), datetime('now'))
     ON CONFLICT(date, page_id) DO UPDATE SET
       page_url = CASE WHEN excluded.page_url != '' THEN excluded.page_url ELSE analytics_page_daily.page_url END,
       message_count = max(0, analytics_page_daily.message_count + ?),
       updated_at = datetime('now')`
  ).bind(date, pageId, pageUrl || '', delta, delta).run();
}
