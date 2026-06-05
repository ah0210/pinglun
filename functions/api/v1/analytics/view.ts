// functions/api/v1/analytics/view.ts — 访问事件上报
import { recordPageView } from '../../../../lib/analytics';
import { apiHandler } from '../../../../lib/middleware';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { AnalyticsViewBody } from '../../../../lib/analytics';

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as AnalyticsViewBody;

  try {
    const stats = await recordPageView(env, request, body);
    return successResponse(stats, noCacheHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : '访问统计参数无效';
    return errorResponse(ErrorCode.VALIDATION_ERROR, message, 400);
  }
}, { requireAuth: false });

