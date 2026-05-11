// lib/cors.ts — CORS 跨域中间件

import type { Env } from './types';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://you-guestbook.pages.dev',
  'https://guestbook.17you.com',
];

/** 响应中需要清除的 CORS 头（防止 wrangler dev server 自动添加的通配符头冲突） */
const CORS_HEADERS = [
  'Access-Control-Allow-Origin',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Credentials',
  'Access-Control-Max-Age',
  'Access-Control-Expose-Headers',
];

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || DEFAULT_ALLOWED_ORIGINS;

  // 防御：过滤掉通配符和空值，避免 Allow-Credentials + * 的安全隐患
  const safeOrigins = allowed.filter(o => o && o !== '*');

  if (!safeOrigins.includes(origin)) {
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function handlePreflight(request: Request, env: Env): Response | null {
  if (request.method === 'OPTIONS') {
    const headers = corsHeaders(request, env);
    // 如果 origin 不在白名单，返回 403 避免 wrangler 自动补通配符头
    if (!headers['Access-Control-Allow-Origin']) {
      return new Response('CORS origin not allowed', { status: 403 });
    }
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  return null;
}

/** 为任意 Response 添加 CORS 头（先清除已有的，防止与 wrangler 自动添加的冲突） */
export function withCors(response: Response, request: Request, env: Env): Response {
  // 先删除可能由 wrangler dev server 自动添加的 CORS 头
  for (const h of CORS_HEADERS) {
    response.headers.delete(h);
  }
  // 再设置我们自己的
  const headers = corsHeaders(request, env);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}
