// functions/api/v1/admin/messages/batch-delete.ts — 批量删除留言
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { logAdminAction } from '../../../../lib/admin-log';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const body = await request.json() as { ids: number[] };

  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请提供要删除的留言ID列表', 400);
  }

  if (body.ids.length > 100) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '一次最多删除 100 条', 400);
  }

  const placeholders = body.ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `DELETE FROM messages WHERE id IN (${placeholders})`
  ).bind(...body.ids).run();

  await logAdminAction(
    env, user!.userId, 'batch_delete_messages',
    'message', 0,
    JSON.stringify({ ids: body.ids, count: result.meta.changes }),
    getClientIp(request)
  );

  return successResponse({ deleted: result.meta.changes });
}, { requireAdmin: true });
