// functions/api/v1/auth/verify-email.ts — 邮箱验证确认
import { apiHandler } from '../../../../lib/middleware';
import { hashToken } from '../../../../lib/jwt';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import type { Env, DbVerification } from '../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '缺少验证 token', 400);
  }

  // 哈希 token 后查找验证记录（与 refresh_tokens 一致的安全策略）
  const tokenHash = await hashToken(token);
  const verification = await env.DB.prepare(
    'SELECT * FROM email_verifications WHERE token = ?'
  ).bind(tokenHash).first<DbVerification>();

  if (!verification) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '验证链接无效', 400);
  }

  if (verification.verified) {
    return successResponse({ message: '邮箱已验证' });
  }

  // 检查是否过期
  if (new Date(verification.expires_at) < new Date()) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '验证链接已过期，请重新发送', 400);
  }

  // 标记为已验证
  await env.DB.prepare(
    'UPDATE email_verifications SET verified = 1 WHERE id = ?'
  ).bind(verification.id).run();

  // 更新用户邮箱验证状态
  await env.DB.prepare(
    'UPDATE users SET email_verified = 1 WHERE id = ?'
  ).bind(verification.user_id).run();

  return successResponse({ message: '邮箱验证成功' });
}, { requireAuth: false });
