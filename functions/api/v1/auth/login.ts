// functions/api/v1/auth/login.ts — 用户登录（返回双 Token）
import { apiHandler } from '../../../../lib/middleware';
import { verifyPassword } from '../../../../lib/crypto';
import { verifyTurnstile } from '../../../../lib/turnstile';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../lib/jwt';
import { getAvatarUrl } from '../../../../lib/avatar';
import { ErrorCode, errorResponse } from '../../../../lib/response';
import type { Env, DbUser } from '../../../../lib/types';

// 暴力破解防护：内存中的失败计数（单实例有效，Workers 多实例但已由 Turnstile 兜底）
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 分钟锁定

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as {
    login: string;
    password: string;
    turnstileToken: string;
  };

  if (!body.login || !body.password || !body.turnstileToken) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写所有必填字段', 400);
  }

  // 暴力破解防护：检查 IP 是否被锁定
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const attempt = loginAttempts.get(clientIP);
  if (attempt && attempt.lockedUntil > Date.now()) {
    const remaining = Math.ceil((attempt.lockedUntil - Date.now()) / 1000);
    return errorResponse(ErrorCode.RATE_LIMITED, `登录失败次数过多，请 ${remaining} 秒后重试`, 429);
  }

  // Turnstile 验证
  const turnstileValid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY);
  if (!turnstileValid) {
    return errorResponse(ErrorCode.TURNSTILE_FAILED, '验证码验证失败，请重试', 400);
  }

  // 查找用户（用户名或邮箱）
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE (username = ? OR email = ?) AND status = ?'
  ).bind(body.login.trim().toLowerCase(), body.login.trim().toLowerCase(), 'active').first<DbUser>();

  if (!user) {
    recordFailedAttempt(clientIP);
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户名或密码错误', 401);
  }

  // 验证密码
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    recordFailedAttempt(clientIP);
    return errorResponse(ErrorCode.WRONG_PASSWORD, '用户名或密码错误', 401);
  }

  // 登录成功：清除失败计数
  loginAttempts.delete(clientIP);

  // 更新最后登录时间
  await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();

  // 生成 Refresh Token
  const refreshToken = generateToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const refreshExpiry = getRefreshTokenExpiry();
  const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).bind(user.id, refreshTokenHash, expiresAt).run();

  // 生成 Access Token
  const accessToken = await signAccessToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  }, env);

  // 确保 avatar 有值
  const avatar = user.avatar || getAvatarUrl(user.email);

  return new Response(JSON.stringify({
    success: true,
    data: {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        email: user.email,
        avatar,
        role: user.role,
        emailVerified: user.email_verified === 1,
      },
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=${refreshExpiry}`,
    },
  });
}, { requireAuth: false });

/** 记录登录失败次数，达到上限后锁定 IP */
function recordFailedAttempt(ip: string) {
  const current = loginAttempts.get(ip);
  if (!current || current.lockedUntil < Date.now()) {
    loginAttempts.set(ip, { count: 1, lockedUntil: 0 });
  } else {
    current.count++;
    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
    }
  }
}
