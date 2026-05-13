// lib/zhihu.ts — 知乎 OAuth API 封装（授权码换 Token + 获取用户信息）

const ZHIHU_BASE_URL = 'https://openapi.zhihu.com';

/** 知乎 access_token 响应 */
interface ZhihuTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/** 知乎用户信息响应 */
interface ZhihuUserInfo {
  uid: number;
  fullname: string;
  gender: string;
  headline: string;
  description: string;
  avatar_path: string;
  phone_no: string;
  email: string;
}

/** 知乎 API 错误响应 */
interface ZhihuErrorResponse {
  code: number;
  data: string;
}

/** 使用授权码换取 access_token */
export async function exchangeCodeForToken(params: {
  appId: string;
  appKey: string;
  code: string;
  redirectUri: string;
}): Promise<ZhihuTokenResponse> {
  const { appId, appKey, code, redirectUri } = params;

  const body = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });

  const resp = await fetch(`${ZHIHU_BASE_URL}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = await resp.json() as ZhihuTokenResponse | ZhihuErrorResponse;

  if ('code' in data && data.code) {
    throw new Error(`知乎 Token 交换失败: ${(data as ZhihuErrorResponse).data}`);
  }

  return data as ZhihuTokenResponse;
}

/** 使用 access_token 获取知乎用户信息 */
export async function fetchZhihuUser(accessToken: string): Promise<ZhihuUserInfo> {
  const resp = await fetch(`${ZHIHU_BASE_URL}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await resp.json() as ZhihuUserInfo | ZhihuErrorResponse;

  if ('code' in data && data.code) {
    throw new Error(`知乎用户信息获取失败: ${(data as ZhihuErrorResponse).data}`);
  }

  return data as ZhihuUserInfo;
}

/** 生成知乎授权页 URL */
export function buildAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const { appId, redirectUri, state } = params;
  const query = new URLSearchParams({
    redirect_uri: redirectUri,
    app_id: appId,
    response_type: 'code',
    state,
  });
  return `${ZHIHU_BASE_URL}/authorize?${query.toString()}`;
}

/** 生成随机 state 参数（CSRF 防护） */
export function generateState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export type { ZhihuTokenResponse, ZhihuUserInfo };
