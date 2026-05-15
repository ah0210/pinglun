// functions/api/v1/auth/login.ts — 用户登录（返回双 Token）
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { verifyPassword } from '../../../../lib/crypto';
import { verifyTurnstile, shouldSkipTurnstile } from '../../../../lib/turnstile';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../lib/jwt';
import { getAvatarUrl } from '../../../../lib/avatar';
import { ErrorCode, errorResponse } from '../../../../lib/response';
import type { Env, DbUser } from '../../../../lib/types';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 15 * 60; // 15 分钟锁定

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as {
    login: string;
    password: string;
    turnstileToken: string;
  };

  if (!body.login || !body.password) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写所有必填字段', 400);
  }

  // 分布式暴力破解防护：基于 D1 查询失败次数（跨边缘节点生效）
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const lockoutSince = new Date(Date.now() - LOCKOUT_SECONDS * 1000).toISOString();

  // 查询锁定时间窗口内的失败次数
  const recentFails = await env.DB.prepare(
    'SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = ? AND success = 0 AND created_at > ?'
  ).bind(clientIP, lockoutSince).first<{ count: number }>();

  if (recentFails && recentFails.count >= MAX_ATTEMPTS) {
    const oldestFail = await env.DB.prepare(
      'SELECT created_at FROM login_attempts WHERE ip_address = ? AND success = 0 AND created_at > ? ORDER BY created_at ASC LIMIT 1'
    ).bind(clientIP, lockoutSince).first<{ created_at: string }>();
    const remaining = oldestFail
      ? Math.ceil((new Date(oldestFail.created_at).getTime() + LOCKOUT_SECONDS * 1000 - Date.now()) / 1000)
      : LOCKOUT_SECONDS;
    return errorResponse(ErrorCode.RATE_LIMITED, `登录失败次数过多，请 ${remaining} 秒后重试`, 429);
  }

  // Turnstile 验证（未配置、测试密钥或管理员开启紧急降级时跳过）
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

  // 查找用户（用户名、邮箱或手机号）
  const user = await env.DB.prepare(
    'SELECT * FROM users WHERE (username = ? OR email = ? OR phone = ?) AND status = ?'
  ).bind(body.login.trim().toLowerCase(), body.login.trim().toLowerCase(), body.login.trim(), 'active').first<DbUser>();

  if (!user) {
    await recordFailedAttempt(env, clientIP);
    return errorResponse(ErrorCode.WRONG_PASSWORD, '用户名或密码错误', 401);
  }

  // 验证密码
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    await recordFailedAttempt(env, clientIP);
    return errorResponse(ErrorCode.WRONG_PASSWORD, '用户名或密码错误', 401);
  }

  // 登录成功：记录成功尝试 + 清理旧的失败记录
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip_address, success) VALUES (?, 1)'
  ).bind(clientIP).run();

  // 清理超过 30 分钟的旧记录，避免表无限增长
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'DELETE FROM login_attempts WHERE created_at < ?'
  ).bind(cutoff).run();

  // 顺手清理过期和已吊销超过 30 天的 Refresh Token
  await env.DB.prepare(
    "DELETE FROM refresh_tokens WHERE (expires_at < datetime('now')) OR (revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days'))"
  ).run();

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
        phone: user.phone,
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

/** 记录登录失败到 D1（跨边缘节点生效） */
async function recordFailedAttempt(env: Env, ip: string): Promise<void> {
  await env.DB.prepare(
    'INSERT INTO login_attempts (ip_address, success) VALUES (?, 0)'
  ).bind(ip).run();
}
