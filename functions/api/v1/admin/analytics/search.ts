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
     WHERE channel = 'search' AND created_at >= datetime('now', ?)
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
     WHERE channel = 'search' AND created_at >= datetime('now', ?)
     GROUP BY page_id
     ORDER BY views DESC
     LIMIT 30`
  ).bind(`-${days} days`).all();

  // 3. 搜索流量趋势（按天统计，用于绘制趋势图）
  const trend = await env.DB.prepare(
    `SELECT date(created_at) as date,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', ?)
     GROUP BY date(created_at)
     ORDER BY date ASC`
  ).bind(`-${days} days`).all();

  // 4. 搜索流量国家/地区分布
  const countries = await env.DB.prepare(
    `SELECT country,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', ?)
       AND country != ''
     GROUP BY country
     ORDER BY views DESC
     LIMIT 20`
  ).bind(`-${days} days`).all();

  return successResponse({
    engines: engines.results || [],
    pages: pages.results || [],
    trend: trend.results || [],
    countries: countries.results || [],
  }, noCacheHeaders());
}, { requireAdmin: true });
