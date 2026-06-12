// functions/api/v1/auth/register.ts — 用户注册
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { hashPassword } from '../../../../lib/crypto';
import { verifyTurnstile, shouldSkipTurnstile } from '../../../../lib/turnstile';
import { sendEmail, buildVerifyEmailHtml } from '../../../../lib/email';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../lib/jwt';
import { getAvatarUrl } from '../../../../lib/avatar';
import { escapeHtml, sanitizeUsername, sanitizeEmail, validatePasswordStrength, validateEmail, validatePhone } from '../../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbUser } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx) => {
  const body = await request.json() as {
    username: string;
    email: string;
    phone: string;
    password: string;
    turnstileToken: string;
  };

  // 验证必填字段
  if (!body.username || !body.email || !body.phone || !body.password) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写所有必填字段', 400);
  }

  // Turnstile 验证（仅管理员开启紧急降级时跳过）
  const turnstileConfig = await env.DB.prepare(
    'SELECT force_skip_turnstile FROM board_config WHERE id = 1'
  ).first<{ force_skip_turnstile: number }>();
  if (!shouldSkipTurnstile(env.TURNSTILE_SECRET_KEY || '', turnstileConfig?.force_skip_turnstile === 1)) {
    if (!body.turnstileToken || !body.turnstileToken.trim()) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '请完成验证码验证', 400);
    }
    const turnstileValid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, getClientIp(request));
    if (!turnstileValid) {
      return errorResponse(ErrorCode.TURNSTILE_FAILED, '验证码验证失败，请重试', 400);
    }
  }

  // IP 频率限制检查（10分钟内最多3次）
  const clientIp = getClientIp(request);
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const attempts = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM register_attempts WHERE ip_address = ? AND created_at > ?'
  ).bind(clientIp, tenMinutesAgo).first<{ count: number }>();

  if (attempts && attempts.count >= 3) {
    return errorResponse(ErrorCode.RATE_LIMITED, '注册尝试过于频繁，请 10 分钟后再试', 429);
  }

  // 记录此次注册尝试
  await env.DB.prepare(
    'INSERT INTO register_attempts (ip_address) VALUES (?)'
  ).bind(clientIp).run();

  const username = sanitizeUsername(body.username);
  const email = sanitizeEmail(body.email);
  const phone = body.phone.trim();
  const password = body.password;

  // 验证用户名格式
  if (username.length < 2 || username.length > 30) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '用户名长度需在 2-30 之间', 400);
  }

  // 验证密码强度
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, passwordError, 400);
  }

  // 严格验证邮箱格式
  const emailError = validateEmail(email);
  if (emailError) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, emailError, 400);
  }

  // 严格验证手机号格式
  const phoneError = validatePhone(phone);
  if (phoneError) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, phoneError, 400);
  }

  // 检查注册开关
  const config = await env.DB.prepare('SELECT allow_registration FROM board_config WHERE id = 1').first<{ allow_registration: number }>();
  if (config && !config.allow_registration) {
    return errorResponse(ErrorCode.REGISTRATION_DISABLED, '注册功能已关闭', 403);
  }

  // 检查用户名/邮箱/手机号是否已存在
  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ? OR phone = ?'
  ).bind(username, email, phone).first();
  if (existing) {
    return errorResponse(ErrorCode.USERNAME_TAKEN, '用户名、邮箱或手机号已被注册', 409);
  }

  // 创建用户
  const passwordHash = await hashPassword(password);
  const avatar = getAvatarUrl(email);

  const result = await env.DB.prepare(
    `INSERT INTO users (username, email, phone, password_hash, avatar) VALUES (?, ?, ?, ?, ?)`
  ).bind(username, email, phone, passwordHash, avatar).run();

  const userId = result.meta.last_row_id as number;

  // 检查是否是第一个用户——如果是则自动升级为管理员（免去 setup 步骤）
  const userCount = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM users'
  ).first<{ count: number }>();
  const isFirstUser = userCount && userCount.count === 1;
  let role = 'user';

  if (isFirstUser) {
    role = 'admin';
    await env.DB.prepare(
      "UPDATE users SET role = 'admin', email_verified = 1 WHERE id = ?"
    ).bind(userId).run();
  }

  // 生成 Refresh Token
  const refreshToken = generateToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const refreshExpiry = getRefreshTokenExpiry();
  const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).bind(userId, refreshTokenHash, expiresAt).run();

  // 生成 Access Token
  const accessToken = await signAccessToken({ userId, username, role }, env);

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
  // 不 await — 邮件发送失败不影响注册，但使用 waitUntil 确保 Worker 不提前销毁
  ctx.waitUntil(sendEmail({ to: email, subject: '请验证您的邮箱', html }, env).catch(() => {}));

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
        phone: user!.phone,
        emailVerified: user!.email_verified === 1,
        avatar: user!.avatar,
        role,
      },
    },
  }), {
    status: 201,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=${refreshExpiry}`,
    },
  });
}, { requireAuth: false });
