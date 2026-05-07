// functions/api/v1/auth/change-password.ts — 修改密码
import { apiHandler } from '../../../../lib/middleware';
import { verifyPassword, hashPassword } from '../../../../lib/crypto';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbUser, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const body = await request.json() as { currentPassword: string; newPassword: string };

  if (!body.currentPassword || !body.newPassword) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写当前密码和新密码', 400);
  }

  if (body.newPassword.length < 6) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '新密码至少 6 个字符', 400);
  }

  // 获取当前密码哈希
  const dbUser = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user!.userId).first<DbUser>();
  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
  }

  // 验证当前密码
  const valid = await verifyPassword(body.currentPassword, dbUser.password_hash);
  if (!valid) {
    return errorResponse(ErrorCode.WRONG_PASSWORD, '当前密码错误', 400);
  }

  // 更新密码
  const newHash = await hashPassword(body.newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(newHash, user!.userId).run();

  // 吊销所有 Refresh Token（强制重新登录所有设备）
  await env.DB.prepare(
    'UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(user!.userId).run();

  return successResponse({ message: '密码修改成功，请重新登录' });
}, { requireAuth: true });
