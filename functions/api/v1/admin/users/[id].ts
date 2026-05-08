// functions/api/v1/admin/users/[id].ts — 变更用户角色/状态
import { apiHandler, getClientIp } from '../../../../../lib/middleware';
import { logAdminAction } from '../../../../../lib/admin-log';
import { ErrorCode, errorResponse, successResponse } from '../../../../../lib/response';
import type { Env, DbUser, JwtPayload } from '../../../../../lib/types';

export const onRequestPatch = apiHandler(async (request, env, ctx, user) => {
  const rawId = Array.isArray(ctx.params.id) ? ctx.params.id[0] : ctx.params.id;
  const id = parseInt(rawId, 10);
  const body = await request.json() as { role?: string; status?: string };

  if (id === user!.userId) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '不能修改自己的角色或状态', 400);
  }

  const dbUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<DbUser>();
  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
  }

  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.role && ['user', 'admin'].includes(body.role)) {
    updates.push('role = ?');
    binds.push(body.role);
  }

  if (body.status && ['active', 'disabled', 'banned'].includes(body.status)) {
    updates.push('status = ?');
    binds.push(body.status);
  }

  if (updates.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '没有要更新的字段', 400);
  }

  updates.push('updated_at = datetime("now")');
  binds.push(id);

  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

  await logAdminAction(
    env, user!.userId, 'update_user',
    'user', id,
    JSON.stringify({ role: body.role, status: body.status }),
    getClientIp(request)
  );

  return successResponse({ id, role: body.role || dbUser.role, status: body.status || dbUser.status });
}, { requireAdmin: true });
