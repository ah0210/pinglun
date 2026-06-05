// functions/api/v1/admin/analytics/search.ts — 搜索入口统计
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);

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

  return successResponse({
    engines: engines.results || [],
    pages: pages.results || [],
  }, noCacheHeaders());
}, { requireAdmin: true });

