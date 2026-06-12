// functions/api/v1/analytics/view.ts — 访问事件上报（WaitUntil 异步写入）
import { recordPageView } from '../../../../lib/analytics';
import { apiHandler } from '../../../../lib/middleware';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { AnalyticsViewBody } from '../../../../lib/analytics';

export const onRequestPost = apiHandler(async (request, env, ctx) => {
  const body = await request.json() as AnalyticsViewBody;

  try {
    const { stats, writePromise } = await recordPageView(env, request, body);
    // 将 D1 Batch 写入放入后台执行，接口立即返回乐观预测数据
    ctx.waitUntil(writePromise);
    return successResponse(stats, noCacheHeaders());
  } catch (error) {
    const message = error instanceof Error ? error.message : '访问统计参数无效';
    return errorResponse(ErrorCode.VALIDATION_ERROR, message, 400);
  }
}, { requireAuth: false });

