// functions/api/v1/auth/refresh.ts — 刷新 Access Token（Token Rotation）
import { apiHandler, getRefreshTokenFromCookie } from '../../../../lib/middleware';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry, verifyAccessToken } from '../../../../lib/jwt';
import { ErrorCode, errorResponse } from '../../../../lib/response';
import type { Env, DbUser, DbRefreshToken, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env) => {
  // 从 Cookie 中获取 Refresh Token
  const refreshToken = getRefreshTokenFromCookie(request);
  if (!refreshToken) {
    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, '缺少 Refresh Token', 401);
  }

  // 哈希后查找 token
  const tokenHash = await hashToken(refreshToken);
  const storedToken = await env.DB.prepare(
    `SELECT rt.*, u.username, u.role, u.status, u.email, u.display_name, u.avatar
     FROM refresh_tokens rt
     JOIN users u ON rt.user_id = u.id
     WHERE rt.token_hash = ?`
  ).bind(tokenHash).first<DbRefreshToken & { username: string; role: string; status: string; email: string; display_name: string; avatar: string }>();

  if (!storedToken) {
    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, 'Refresh Token 无效', 401);
  }

  // 检查是否已吊销
  if (storedToken.revoked_at) {
    // 检测到已吊销的 token 被重放 — 说明 token 可能被窃取
    // 安全策略：吊销该用户的所有 refresh token，强制重新登录
    await env.DB.prepare(
      'UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE user_id = ? AND revoked_at IS NULL'
    ).bind(storedToken.user_id).run();

    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, '检测到异常令牌使用，请重新登录', 401);
  }

  // 检查是否过期
  if (new Date(storedToken.expires_at) < new Date()) {
    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, 'Refresh Token 已过期', 401);
  }

  // 检查用户状态
  if (storedToken.status !== 'active') {
    return errorResponse(ErrorCode.FORBIDDEN, '账号已被禁用', 403);
  }

  // Token Rotation：吊销旧 token
  await env.DB.prepare(
    'UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE id = ?'
  ).bind(storedToken.id).run();

  // 生成新 Refresh Token
  const newRefreshToken = generateToken();
  const newTokenHash = await hashToken(newRefreshToken);
  const refreshExpiry = getRefreshTokenExpiry();
  const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
  ).bind(storedToken.user_id, newTokenHash, expiresAt).run();

  // 生成新 Access Token
  const accessToken = await signAccessToken({
    userId: storedToken.user_id,
    username: storedToken.username,
    role: storedToken.role,
  }, env);

  return new Response(JSON.stringify({
    success: true,
    data: {
      accessToken,
      user: {
        id: storedToken.user_id,
        username: storedToken.username,
        displayName: storedToken.display_name || storedToken.username,
        email: storedToken.email,
        avatar: storedToken.avatar,
        role: storedToken.role,
      },
    },
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `refresh_token=${newRefreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=${refreshExpiry}`,
    },
  });
}, { requireAuth: false });
