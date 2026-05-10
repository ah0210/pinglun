// functions/api/v1/auth/logout.ts — 登出（吊销 Refresh Token）
import { apiHandler, getRefreshTokenFromCookie, authenticate } from '../../../../lib/middleware';
import { hashToken } from '../../../../lib/jwt';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import type { Env } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const refreshToken = getRefreshTokenFromCookie(request);

  if (refreshToken) {
    // 吊销该 Refresh Token
    const tokenHash = await hashToken(refreshToken);
    await env.DB.prepare(
      'UPDATE refresh_tokens SET revoked_at = datetime("now") WHERE token_hash = ? AND revoked_at IS NULL'
    ).bind(tokenHash).run();
  }

  // 如果用户已登录，也可以吊销所有该用户的 token（可选的强制登出所有设备）
  // 这里只吊销当前 token

  return new Response(JSON.stringify({ success: true, data: null }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'refresh_token=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=0',
    },
  });
}, { requireAuth: true });
