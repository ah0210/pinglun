// functions/api/v1/admin/messages/[id].ts — 审核/删除留言
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { logAdminAction } from '../../../../lib/admin-log';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbMessage, JwtPayload } from '../../../../lib/types';

// PATCH — 审核留言
export const onRequestPatch = apiHandler(async (request, env, ctx, user) => {
  const id = ctx.params.id;
  const body = await request.json() as { status: string };

  if (!['approved', 'rejected'].includes(body.status)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '状态只能是 approved 或 rejected', 400);
  }

  const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(id).first();
  if (!message) {
    return errorResponse(ErrorCode.MESSAGE_NOT_FOUND, '留言不存在', 404);
  }

  await env.DB.prepare('UPDATE messages SET status = ? WHERE id = ?').bind(body.status, id).run();

  await logAdminAction(
    env, user!.userId,
    body.status === 'approved' ? 'approve_message' : 'reject_message',
    'message', parseInt(id), '',
    getClientIp(request)
  );

  return successResponse({ id: parseInt(id), status: body.status });
}, { requireAdmin: true });

// DELETE — 删除留言
export const onRequestDelete = apiHandler(async (request, env, ctx, user) => {
  const id = ctx.params.id;

  const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ?').bind(id).first();
  if (!message) {
    return errorResponse(ErrorCode.MESSAGE_NOT_FOUND, '留言不存在', 404);
  }

  await env.DB.prepare('DELETE FROM messages WHERE id = ?').bind(id).run();

  await logAdminAction(
    env, user!.userId, 'delete_message',
    'message', parseInt(id), '',
    getClientIp(request)
  );

  return successResponse({ id: parseInt(id), deleted: true });
}, { requireAdmin: true });
