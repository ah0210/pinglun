// functions/api/v1/admin/analytics/channels.ts — 渠道统计
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);

  const rows = await env.DB.prepare(
    `SELECT channel,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors,
            COUNT(DISTINCT session_id) as sessions
     FROM analytics_events
     WHERE created_at >= datetime('now', '+8 hours', ?)
     GROUP BY channel
     ORDER BY views DESC`
  ).bind(`-${days} days`).all();

  return successResponse(rows.results || [], noCacheHeaders());
}, { requireAdmin: true });

