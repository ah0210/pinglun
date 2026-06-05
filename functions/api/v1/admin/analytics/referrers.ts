// functions/api/v1/admin/analytics/referrers.ts — 来源域名统计
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);

  const rows = await env.DB.prepare(
    `SELECT referrer_domain as referrerDomain,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE referrer_domain != '' AND created_at >= datetime('now', ?)
     GROUP BY referrer_domain
     ORDER BY views DESC
     LIMIT 50`
  ).bind(`-${days} days`).all();

  return successResponse(rows.results || [], noCacheHeaders());
}, { requireAdmin: true });

