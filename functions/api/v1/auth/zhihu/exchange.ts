// functions/api/v1/auth/zhihu/exchange.ts — 临时授权码 auth_code 换取 Access Token + Refresh Token
import { apiHandler } from '../../../../../lib/middleware';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../../lib/jwt';
import { getAvatarUrl } from '../../../../../lib/avatar';
import { ErrorCode, errorResponse, successResponse } from '../../../../../lib/response';
import { toPublicUser } from '../../../../../lib/types';
import type { Env, DbUser } from '../../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env) => {
  const body = await request.json() as {
    auth_code: string;
  };

  if (!body.auth_code || !body.auth_code.trim()) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '参数错误', 400);
  }

  const code = body.auth_code.trim();

  // 1. 查询临时授权码
  const record = await env.DB.prepare(
    'SELECT * FROM oauth_auth_codes WHERE code = ?'
  ).bind(code).first<{ code: string; user_id: number; expires_at: string }>();

  if (!record) {
    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, '授权码无效或已过期', 400);
  }

  // 2. 立即删除授权码（一次性使用，防止重放攻击）
  await env.DB.prepare(
    'DELETE FROM oauth_auth_codes WHERE code = ?'
  ).bind(code).run();

  // 3. 校验过期时间
  if (new Date(record.expires_at).getTime() < Date.now()) {
    return errorResponse(ErrorCode.REFRESH_TOKEN_INVALID, '授权码已过期', 400);
  }

  // 4. 查询关联用户
  const dbUser = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ? AND status = ?'
  ).bind(record.user_id, 'active').first<DbUser>();

  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '关联用户不存在或已被禁用', 404);
  }

  // 5. 签发 Access Token
  const accessToken = await signAccessToken({
    userId: dbUser.id,
    username: dbUser.username,
    role: dbUser.role,
  }, env);

  // 6. 签发 Refresh Token
  const refreshToken = generateToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const refreshExpiry = getRefreshTokenExpiry();
  const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

  await env.DB.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
  ).bind(dbUser.id, refreshTokenHash, expiresAt).run();

  // 7. 更新最后登录时间
  await env.DB.prepare(
    'UPDATE users SET last_login_at = datetime("now") WHERE id = ?'
  ).bind(dbUser.id).run();

  // 8. 返回结果并种植 Refresh Token Cookie
  const publicUser = toPublicUser(dbUser);
  const avatar = publicUser.avatar || getAvatarUrl(dbUser.email);
  publicUser.avatar = avatar;

  const resp = successResponse({
    accessToken,
    user: publicUser,
  });

  resp.headers.append('Set-Cookie', `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=${refreshExpiry}`);
  return resp;
}, { requireAuth: false });
