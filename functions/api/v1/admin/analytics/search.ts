// functions/api/v1/admin/analytics/search.ts — 搜索来源分析（增强版）
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);

  // 1. 搜索引擎来源分布
  const engines = await env.DB.prepare(
    `SELECT referrer_domain as referrerDomain,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY referrer_domain
     ORDER BY views DESC
     LIMIT 30`
  ).bind(`-${days} days`).all();

  // 2. 搜索着陆页排行（哪些页面从搜索引擎获得最多流量）
  const pages = await env.DB.prepare(
    `SELECT page_id as pageId,
            MAX(page_title) as pageTitle,
            MAX(page_url) as pageUrl,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY page_id
     ORDER BY views DESC
     LIMIT 30`
  ).bind(`-${days} days`).all<{ pageId: string; pageTitle: string; pageUrl: string; views: number; visitors: number }>();

  // 2b. 为每个着陆页补充：总浏览量（用于计算搜索占比）+ 主要搜索引擎来源
  const landingPages = pages.results || [];
  if (landingPages.length > 0) {
    const pageIds = landingPages.map(p => p.pageId);

    // 批量获取各页面总浏览量
    const totalViewsRows = await env.DB.prepare(
      `SELECT page_id as pageId, views as totalViews
       FROM analytics_page_totals
       WHERE page_id IN (${pageIds.map(() => '?').join(',')})`
    ).bind(...pageIds).all<{ pageId: string; totalViews: number }>();

    const totalViewsMap = new Map(
      (totalViewsRows.results || []).map(r => [r.pageId, r.totalViews])
    );

    // 批量获取各页面的搜索引擎分布（Top 3）
    const engineRows = await env.DB.prepare(
      `SELECT page_id as pageId, referrer_domain as engine, COUNT(*) as cnt
       FROM analytics_events
       WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
         AND page_id IN (${pageIds.map(() => '?').join(',')})
       GROUP BY page_id, referrer_domain
       ORDER BY page_id, cnt DESC`
    ).bind(`-${days} days`, ...pageIds).all<{ pageId: string; engine: string; cnt: number }>();

    // 按 pageId 聚合 Top 3 搜索引擎
    const engineMap = new Map<string, string[]>();
    for (const row of engineRows.results || []) {
      const list = engineMap.get(row.pageId) || [];
      if (list.length < 3) list.push(row.engine);
      engineMap.set(row.pageId, list);
    }

    // 合并到着陆页数据
    for (const page of landingPages) {
      (page as any).totalViews = totalViewsMap.get(page.pageId) || page.views;
      (page as any).topEngines = engineMap.get(page.pageId) || [];
    }
  }

  // 3. 搜索流量趋势（按天统计，用于绘制趋势图）
  const trend = await env.DB.prepare(
    `SELECT date(created_at, '+8 hours') as date,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY date(created_at, '+8 hours')
     ORDER BY date ASC`
  ).bind(`-${days} days`).all();

  // 4. 搜索流量国家/地区分布
  const countries = await env.DB.prepare(
    `SELECT country,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
       AND country != ''
     GROUP BY country
     ORDER BY views DESC
     LIMIT 20`
  ).bind(`-${days} days`).all();

  return successResponse({
    engines: engines.results || [],
    pages: landingPages,
    trend: trend.results || [],
    countries: countries.results || [],
  }, noCacheHeaders());
}, { requireAdmin: true });
