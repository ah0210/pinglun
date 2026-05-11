// functions/api/v1/auth/forgot-password.ts — 忘记密码（发送重置邮件）
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { verifyTurnstile, isTurnstileConfigured } from '../../../../lib/turnstile';
import { sendEmail, buildResetPasswordHtml } from '../../../../lib/email';
import { generateToken, hashToken } from '../../../../lib/jwt';
import { sanitizeEmail } from '../../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbUser } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as { email?: string; turnstileToken?: string };

  if (!body.email) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写邮箱', 400);
  }

  const email = sanitizeEmail(body.email);

  // Turnstile 验证（未配置时跳过）
  if (isTurnstileConfigured(env.TURNSTILE_SECRET_KEY || '')) {
    if (!body.turnstileToken) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '请完成验证码验证', 400);
    }
    const valid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY);
    if (!valid) {
      return errorResponse(ErrorCode.TURNSTILE_FAILED, '验证码验证失败', 400);
    }
  }

  // IP 频率限制：5分钟3次
  const clientIp = getClientIp(request);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const ipCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM password_resets WHERE ip_address = ? AND created_at > ?'
  ).bind(clientIp, fiveMinAgo).first<{ count: number }>();
  if (ipCount && ipCount.count >= 3) {
    return errorResponse(ErrorCode.RATE_LIMITED, '请求太频繁，请稍后再试', 429);
  }

  // 邮箱频率限制：1分钟1次
  const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString();
  const emailCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE u.email = ? AND pr.created_at > ?'
  ).bind(email, oneMinAgo).first<{ count: number }>();
  if (emailCount && emailCount.count >= 1) {
    return errorResponse(ErrorCode.RATE_LIMITED, '请求太频繁，请稍后再试', 429);
  }

  // 查找用户（无论是否存在均返回模糊提示，防邮箱枚举）
  const dbUser = await env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first<DbUser>();

  if (dbUser) {
    // 生成重置 token
    const resetToken = generateToken();
    const resetTokenHash = await hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1小时有效

    await env.DB.prepare(
      'INSERT INTO password_resets (user_id, token_hash, expires_at, ip_address) VALUES (?, ?, ?, ?)'
    ).bind(dbUser.id, resetTokenHash, expiresAt, clientIp).run();

    // 发送邮件（异步，使用 waitUntil 确保 Worker 不提前销毁）
    const resetUrl = `${env.PUBLIC_URL}/api/v1/auth/reset-password?token=${resetToken}`;
    const html = buildResetPasswordHtml(dbUser.username, resetUrl);
    ctx.waitUntil(sendEmail({ to: dbUser.email, subject: '重置您的密码', html }, env).catch(() => {}));
  }

  // 统一模糊提示，防枚举
  return successResponse({
    message: '如果该邮箱已注册，您将收到重置密码的邮件',
  });
}, { requireAuth: false });
