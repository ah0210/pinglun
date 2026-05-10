// functions/api/v1/auth/resend-verification.ts — 重发验证邮件
import { apiHandler } from '../../../../lib/middleware';
import { sendEmail, buildVerifyEmailHtml } from '../../../../lib/email';
import { generateToken, hashToken } from '../../../../lib/jwt';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import type { Env, DbUser, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const dbUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user!.userId).first<DbUser>();

  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
  }

  if (dbUser.email_verified) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '邮箱已验证', 400);
  }

  // 检查发送频率（1分钟1次）
  const lastVerification = await env.DB.prepare(
    `SELECT created_at FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(user!.userId).first<{ created_at: string }>();

  if (lastVerification) {
    const elapsed = Date.now() - new Date(lastVerification.created_at).getTime();
    if (elapsed < 60 * 1000) {
      return errorResponse(ErrorCode.RATE_LIMITED, '发送太频繁，请稍后再试', 429);
    }
  }

  // 生成新验证 token
  const verifyToken = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

  const verifyTokenHash = await hashToken(verifyToken);
  await env.DB.prepare(
    `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).bind(user!.userId, verifyTokenHash, expiresAt).run();

  // 发送邮件
  const verifyUrl = `${env.PUBLIC_URL}/api/v1/auth/verify-email?token=${verifyToken}`;
  const html = buildVerifyEmailHtml(dbUser.username, verifyUrl);
  const sent = await sendEmail({ to: dbUser.email, subject: '请验证您的邮箱', html }, env);

  if (!sent) {
    return errorResponse(ErrorCode.EMAIL_SEND_FAILED, '邮件发送失败，请稍后重试', 500);
  }

  return successResponse({ message: '验证邮件已发送' });
}, { requireAuth: true });
