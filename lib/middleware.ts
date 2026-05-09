// lib/middleware.ts — 鉴权中间件（JWT + 角色检查）

import type { Env, JwtPayload, PagesFunctionEnv } from './types';
import { verifyAccessToken } from './jwt';
import { ErrorCode, errorResponse } from './response';
import { corsHeaders, handlePreflight } from './cors';

/** 验证 JWT 并将用户信息注入 context.data */
export async function authenticate(request: Request, env: Env): Promise<{ user: JwtPayload } | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(ErrorCode.UNAUTHORIZED, '未登录', 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyAccessToken(token, env);

  if (!payload) {
    return errorResponse(ErrorCode.TOKEN_EXPIRED, 'Access Token 无效或已过期', 401);
  }

  return { user: payload };
}

/** 要求管理员角色 */
export async function requireAdmin(request: Request, env: Env): Promise<{ user: JwtPayload } | Response> {
  const result = await authenticate(request, env);
  if (result instanceof Response) return result;

  if (result.user.role !== 'admin') {
    return errorResponse(ErrorCode.FORBIDDEN, '需要管理员权限', 403);
  }

  return result;
}

/** 从请求中获取客户端 IP */
export function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0] ||
    'unknown';
}

/** 获取 Refresh Token 从 Cookie */
export function getRefreshTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)refresh_token=([^;]*)/);
  return match ? match[1] : null;
}

/** 通用 API 处理器封装 — 自动处理 CORS、预检、错误 */
export function apiHandler(
  handler: (request: Request, env: Env, ctx: EventContext<Env, any, Record<string, unknown>>, user?: JwtPayload) => Promise<Response>,
  options?: { requireAuth?: boolean; requireAdmin?: boolean }
): PagesFunctionEnv {
  return async (context) => {
    const { request, env } = context;

    // 处理 CORS 预检
    const preflight = handlePreflight(request, env);
    if (preflight) return preflight;

    try {
      let user: JwtPayload | undefined;

      if (options?.requireAdmin) {
        const result = await requireAdmin(request, env);
        if (result instanceof Response) return withCors(result, request, env);
        user = result.user;
      } else if (options?.requireAuth) {
        const result = await authenticate(request, env);
        if (result instanceof Response) return withCors(result, request, env);
        user = result.user;
      }

      const response = await handler(request, env, context, user);
      return withCors(response, request, env);
    } catch (error) {
      console.error('API Error:', error);
      return withCors(
        errorResponse(ErrorCode.VALIDATION_ERROR, '服务器内部错误', 500),
        request,
        env
      );
    }
  };
}

const CORS_HEADERS = [
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Credentials',
  'Access-Control-Max-Age',
  'Access-Control-Expose-Headers',
];

function withCors(response: Response, request: Request, env: Env): Response {
  // 先删除已有的 CORS 头（防止 wrangler dev 自动添加的通配符头冲突）
  for (const h of CORS_HEADERS) {
    response.headers.delete(h);
  }
  const headers = corsHeaders(request, env);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}
