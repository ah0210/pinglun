// functions/api/v1/analytics/page.ts — 当前页面统计查询
import { getPageStats } from '../../../../lib/analytics';
import { apiHandler } from '../../../../lib/middleware';
import { cacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const pageId = (url.searchParams.get('pageId') || '').trim();

  if (!pageId) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '缺少 pageId', 400);
  }

  const stats = await getPageStats(env, pageId.slice(0, 500));
  return successResponse(stats, cacheHeaders(60));
}, { requireAuth: false });

