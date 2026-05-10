// functions/api/v1/auth/register.ts — 用户注册
import { apiHandler } from '../../../../lib/middleware';
import { hashPassword } from '../../../../lib/crypto';
import { verifyTurnstile, isTestKey } from '../../../../lib/turnstile';
import { sendEmail, buildVerifyEmailHtml } from '../../../../lib/email';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../lib/jwt';
import { getAvatarUrl } from '../../../../lib/avatar';
import { escapeHtml, sanitizeUsername, sanitizeEmail } from '../../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbUser } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as {
    username: string;
    email: string;
    password: string;
    turnstileToken: string;
  };

  // 验证必填字段（测试密钥环境下 turnstileToken 可选）
  if (!body.username || !body.email || !body.password) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写所有必填字段', 400);
  }
  if (!body.turnstileToken && !isTestKey(env.TURNSTILE_SECRET_KEY || '')) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请完成验证码验证', 400);
  }

  const username = sanitizeUsername(body.username);
  const email = sanitizeEmail(body.email);
  const password = body.password;

  // 验证用户名格式
  if (username.length < 2 || username.length > 30) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '用户名长度需在 2-30 之间', 400);
  }

  // 验证密码强度
  if (password.length < 8) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码至少 8 个字符', 400);
  }
  if (!/[a-zA-Z]/.test(password)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码必须包含至少一个字母', 400);
  }
  if (!/[0-9]/.test(password)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '密码必须包含至少一个数字', 400);
  }

  // 验证邮箱格式
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '邮箱格式不正确', 400);
  }

  // 检查注册开关
  const config = await env.DB.prepare('SELECT allow_registration FROM board_config WHERE id = 1').first<{ allow_registration: number }>();
  if (config && !config.allow_registration) {
    return errorResponse(ErrorCode.REGISTRATION_DISABLED, '注册功能已关闭', 403);
  }

  // Turnstile 验证
  const turnstileValid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY);
  if (!turnstileValid) {
    return errorResponse(ErrorCode.TURNSTILE_FAILED, '验证码验证失败，请重试', 400);
  }

  // 检查用户名/邮箱是否已存在
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).bind(username, email).first();
  if (existing) {
    return errorResponse(ErrorCode.USERNAME_TAKEN, '用户名或邮箱已被注册', 409);
  }

  // 创建用户
  const passwordHash = await hashPassword(password);
  const avatar = getAvatarUrl(email);

  const result = await env.DB.prepare(
    `INSERT INTO users (username, email, password_hash, avatar) VALUES (?, ?, ?, ?)`
  ).bind(username, email, passwordHash, avatar).run();

  const userId = result.meta.last_row_id as number;

  // 生成 Refresh Token
  const refreshToken = generateToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const refreshExpiry = getRefreshTokenExpiry();
  const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).bind(userId, refreshTokenHash, expiresAt).run();

  // 生成 Access Token
  const accessToken = await signAccessToken({ userId, username, role: 'user' }, env);

  // 创建邮箱验证 token
  const verifyToken = generateToken();
  const verifyTokenHash = await hashToken(verifyToken);
  const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)`
  ).bind(userId, verifyTokenHash, verifyExpires).run();

  // 发送验证邮件（异步，不阻塞响应）
  const verifyUrl = `${env.PUBLIC_URL}/api/v1/auth/verify-email?token=${verifyToken}`;
  const html = buildVerifyEmailHtml(username, verifyUrl);
  // 不 await — 邮件发送失败不影响注册
  sendEmail({ to: email, subject: '请验证您的邮箱', html }, env).catch(() => {});

  // 获取完整用户信息
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>();

  return new Response(JSON.stringify({
    success: true,
    data: {
      accessToken,
      user: {
        id: user!.id,
        username: user!.username,
        displayName: user!.display_name || user!.username,
        email: user!.email,
        emailVerified: user!.email_verified === 1,
        avatar: user!.avatar,
        role: user!.role,
      },
    },
  }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=${refreshExpiry}`,
    },
  });
}, { requireAuth: false });
