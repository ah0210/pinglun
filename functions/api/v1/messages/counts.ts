// functions/api/v1/messages/counts.ts — 按 page_id 批量统计留言数量 + 浏览量
import { apiHandler } from '../../../../lib/middleware';
import { cacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const pageIds = Array.from(new Set(
    url.searchParams.getAll('pageId')
      .map(id => id.trim())
      .filter(Boolean)
  )).slice(0, 100);

  if (pageIds.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '缺少 pageId 参数', 400);
  }

  const placeholders = pageIds.map(() => '?').join(', ');

  // 查询留言数量
  const msgRows = await env.DB.prepare(
    `SELECT page_id, COUNT(*) as count
     FROM messages
     WHERE page_id IN (${placeholders})
     GROUP BY page_id`
  ).bind(...pageIds).all<{ page_id: string; count: number }>();

  const counts: Record<string, number> = {};
  for (const pageId of pageIds) counts[pageId] = 0;
  for (const row of msgRows.results || []) counts[row.page_id] = row.count;

  // 查询浏览量（analytics_page_totals 表）
  const viewRows = await env.DB.prepare(
    `SELECT page_id, views, visitors
     FROM analytics_page_totals
     WHERE page_id IN (${placeholders})`
  ).bind(...pageIds).all<{ page_id: string; views: number; visitors: number }>();

  const views: Record<string, { views: number; visitors: number }> = {};
  for (const pageId of pageIds) views[pageId] = { views: 0, visitors: 0 };
  for (const row of viewRows.results || []) {
    views[row.page_id] = { views: row.views || 0, visitors: row.visitors || 0 };
  }

  return successResponse({ counts, views }, {
    ...cacheHeaders(300),
    'Content-Type': 'application/json',
  });
}, { requireAuth: false });
