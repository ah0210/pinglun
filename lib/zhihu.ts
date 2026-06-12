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

  // 仅记录脱敏摘要，不打印 app_key / code 完整值
  console.log('[知乎 Token 交换] 发起请求, code_prefix:', code.substring(0, 6) + '...');

  const resp = await fetch(`${ZHIHU_BASE_URL}/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  // 不打印原始响应（可能含 access_token）
  console.log('[知乎 Token 交换] HTTP 状态:', resp.status);

  const rawText = await resp.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`知乎 Token 交换失败: 响应非 JSON (${resp.status})`);
  }

  if (!resp.ok || (data.code && data.code !== 20000)) {
    const errMsg = data.data || data.error || data.message || data.error_description || `HTTP ${resp.status}`;
    throw new Error(`知乎 Token 交换失败 (${data.code || resp.status}): ${errMsg}`);
  }

  if (!data.access_token) {
    throw new Error(`知乎 Token 交换失败: 响应缺少 access_token`);
  }

  return data as ZhihuTokenResponse;
}

/** 使用 access_token 获取知乎用户信息 */
export async function fetchZhihuUser(accessToken: string): Promise<ZhihuUserInfo> {
  // 不打印 access_token 本身
  console.log('[知乎用户信息] 发起请求');

  const resp = await fetch(`${ZHIHU_BASE_URL}/user`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 不打印原始响应（含用户姓名/邮箱/手机号等 PII）
  console.log('[知乎用户信息] HTTP 状态:', resp.status);

  const rawText = await resp.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`知乎用户信息获取失败: 响应非 JSON (${resp.status})`);
  }

  if (!resp.ok || (data.code && data.code !== 20000)) {
    const errMsg = data.data || data.error || data.message || data.error_description || `HTTP ${resp.status}`;
    throw new Error(`知乎用户信息获取失败 (${data.code || resp.status}): ${errMsg}`);
  }

  if (!data.uid) {
    throw new Error(`知乎用户信息获取失败: 响应缺少 uid`);
  }

  /**
   * 字段兜底：知乎API在应用权限不足或用户未授权时，可能不返回 email/phone_no 字段
   * 此时运行时为 undefined，必须显式补空字符串
   */
  const userInfo: ZhihuUserInfo = {
    uid: data.uid,
    fullname: data.fullname || '',
    gender: data.gender || '',
    headline: data.headline || '',
    description: data.description || '',
    avatar_path: data.avatar_path || '',
    phone_no: data.phone_no || '',
    email: data.email || '',
  };

  // 仅记录 uid（非 PII），不打印邮箱/手机/姓名
  console.log('[知乎用户信息] 解析成功, uid:', userInfo.uid, 'has_email:', !!userInfo.email, 'has_phone:', !!userInfo.phone_no);

  return userInfo;
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
