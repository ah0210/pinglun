// lib/cors.ts — CORS 跨域中间件

import type { Env } from './types';

const DEFAULT_ALLOWED_ORIGINS = [
  'https://cf-guestbook.pages.dev',
];

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowed = env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) || DEFAULT_ALLOWED_ORIGINS;

  if (!allowed.includes(origin)) {
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
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request, env),
    });
  }
  return null;
}

/** 为任意 Response 添加 CORS 头 */
export function withCors(response: Response, request: Request, env: Env): Response {
  const headers = corsHeaders(request, env);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}
