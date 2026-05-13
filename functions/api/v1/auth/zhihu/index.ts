// functions/api/v1/auth/zhihu/index.ts — 发起知乎 OAuth 授权（302 重定向到知乎授权页）

import { buildAuthorizeUrl, generateState } from '../../../../../lib/zhihu';
import { ErrorCode, errorResponse } from '../../../../../lib/response';
import type { Env } from '../../../../../lib/types';

const STATE_COOKIE_MAX_AGE = 600; // state Cookie 有效期 10 分钟

export const onRequestGet = async (context: EventContext<Env, any, Record<string, unknown>>) => {
  const { request, env } = context;

  if (!env.ZHIHU_APP_ID || !env.ZHIHU_APP_KEY) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '知乎 OAuth 未配置', 500);
  }

  const url = new URL(request.url);
  const redirect = url.searchParams.get('redirect') || '';

  const state = generateState();
  const redirectUri = `${env.PUBLIC_URL}/api/v1/auth/zhihu/callback`;
  const authorizeUrl = buildAuthorizeUrl({
    appId: env.ZHIHU_APP_ID,
    redirectUri,
    state,
  });

  // 将 redirect 地址编码后存入 Cookie，回调时读取
  const stateData = JSON.stringify({ s: state, r: redirect });
  const encodedStateData = btoa(unescape(encodeURIComponent(stateData)));

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl,
      'Set-Cookie': `zhihu_oauth_state=${encodedStateData}; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/zhihu/callback; Max-Age=${STATE_COOKIE_MAX_AGE}`,
    },
  });
};
