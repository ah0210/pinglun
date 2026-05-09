// functions/api/v1/_middleware.ts — 全局 CORS 预检拦截
// Cloudflare Pages Functions 按方法名路由（onRequestGet/onRequestPost…），
// OPTIONS 请求没有对应的 onRequestOptions，会直接返回 405。
// 此中间件在所有 /api/v1/* 路由之前执行，拦截 OPTIONS 预检请求。

import { handlePreflight, withCors } from '../../../lib/cors';
import type { Env } from '../../../lib/types';

export async function onRequest(context: EventContext<Env, any, Record<string, unknown>>) {
  const { request, env, next } = context;

  // 1. 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    const preflight = handlePreflight(request, env);
    return preflight || new Response(null, { status: 204 });
  }

  // 2. 正常请求 → 继续到具体路由处理
  const response = await next();

  // 3. 为响应添加 CORS 头
  return withCors(response, request, env);
}
