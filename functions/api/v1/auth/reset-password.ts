// functions/api/v1/auth/reset-password.ts — 重置密码（通过邮件 token）
import { apiHandler } from '../../../../lib/middleware';
import { hashPassword } from '../../../../lib/crypto';
import { hashToken } from '../../../../lib/jwt';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env } from '../../../../lib/types';

interface DbPasswordReset {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as { token?: string; newPassword?: string };

  if (!body.token || !body.newPassword) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写token和新密码', 400);
  }

  // 验证密码强度
  if (body.newPassword.length < 8) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码至少 8 个字符', 400);
  }
  if (!/[a-zA-Z]/.test(body.newPassword)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码必须包含至少一个字母', 400);
  }
  if (!/[0-9]/.test(body.newPassword)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码必须包含至少一个数字', 400);
  }

  // 查找 token 记录
  const tokenHash = await hashToken(body.token);
  const resetRecord = await env.DB.prepare(
    'SELECT * FROM password_resets WHERE token_hash = ?'
  ).bind(tokenHash).first<DbPasswordReset>();

  if (!resetRecord) {
    return errorResponse(ErrorCode.PASSWORD_RESET_INVALID, '重置链接无效', 400);
  }

  if (resetRecord.used) {
    return errorResponse(ErrorCode.PASSWORD_RESET_USED, '重置链接已使用', 400);
  }

  if (new Date(resetRecord.expires_at) < new Date()) {
    return errorResponse(ErrorCode.PASSWORD_RESET_EXPIRED, '重置链接已过期，请重新申请', 400);
  }

  // 更新密码
  const newHash = await hashPassword(body.newPassword);
  await env.DB.prepare(
    'UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(newHash, resetRecord.user_id).run();

  // 标记 token 已使用
  await env.DB.prepare(
    'UPDATE password_resets SET used = 1 WHERE id = ?'
  ).bind(resetRecord.id).run();

  // 吊销所有 Refresh Token（强制重新登录所有设备）
  await env.DB.prepare(
    'UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE user_id = ? AND revoked_at IS NULL'
  ).bind(resetRecord.user_id).run();

  return successResponse({ message: '密码重置成功，请使用新密码登录' });
}, { requireAuth: false });
