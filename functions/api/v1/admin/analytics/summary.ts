// functions/api/v1/admin/analytics/summary.ts — 流量统计概览
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

export const onRequestGet = apiHandler(async (request, env) => {
  const today = await env.DB.prepare(
    `SELECT COALESCE(SUM(views), 0) as views,
            COALESCE(SUM(visitors), 0) as visitors,
            COALESCE(SUM(sessions), 0) as sessions
     FROM analytics_page_daily
     WHERE date = date('now')`
  ).first();

  const yesterday = await env.DB.prepare(
    `SELECT COALESCE(SUM(views), 0) as views,
            COALESCE(SUM(visitors), 0) as visitors,
            COALESCE(SUM(sessions), 0) as sessions
     FROM analytics_page_daily
     WHERE date = date('now', '-1 day')`
  ).first();

  const windows = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN date >= date('now', '-6 days') THEN views ELSE 0 END), 0) as last7Views,
       COALESCE(SUM(CASE WHEN date >= date('now', '-29 days') THEN views ELSE 0 END), 0) as last30Views,
       COALESCE(SUM(CASE WHEN date BETWEEN date('now', '-13 days') AND date('now', '-7 days') THEN views ELSE 0 END), 0) as previous7Views
     FROM analytics_page_daily`
  ).first();

  const topPages = await env.DB.prepare(
    `SELECT page_id as pageId, page_title as pageTitle, page_url as pageUrl,
            views, visitors, sessions, search_views as searchViews, message_count as messageCount
     FROM analytics_page_totals
     ORDER BY views DESC
     LIMIT 10`
  ).all();

  return successResponse({
    today,
    yesterday,
    windows,
    topPages: topPages.results || [],
  }, noCacheHeaders());
}, { requireAdmin: true });

