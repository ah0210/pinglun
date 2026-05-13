// functions/api/v1/auth/zhihu/callback.ts — 知乎 OAuth 授权回调（换 Token、获取用户、创建/登录、重定向前端）

import { exchangeCodeForToken, fetchZhihuUser } from '../../../../../lib/zhihu';
import { signAccessToken, generateToken, hashToken, getRefreshTokenExpiry } from '../../../../../lib/jwt';
import { getAvatarUrl } from '../../../../../lib/avatar';
import type { Env, DbUser, DbOAuthConnection } from '../../../../../lib/types';

const OAUTH_PLACEHOLDER_EMAIL_DOMAIN = 'oauth.placeholder';
const DEFAULT_REDIRECT_URL = 'https://www.17you.com/';

export const onRequestGet = async (context: EventContext<Env, any, Record<string, unknown>>) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // 1. 检查知乎是否返回了错误（用户拒绝授权等）
  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') || '授权失败';
    return redirectToLogin(env, `oauth_error=${encodeURIComponent(errorDesc)}`);
  }

  // 2. 验证 code 参数
  const code = url.searchParams.get('code');
  if (!code) {
    return redirectToLogin(env, 'oauth_error=missing_code');
  }

  // 3. 验证 state 参数（CSRF 防护）+ 从 Cookie 中读取 redirect 地址
  const state = url.searchParams.get('state');
  const cookieStateRaw = getCookieValue(request, 'zhihu_oauth_state');
  let expectedState = '';
  let savedRedirect = '';

  if (cookieStateRaw) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(cookieStateRaw))));
      expectedState = decoded.s || '';
      savedRedirect = decoded.r || '';
    } catch {
      // 旧格式兼容：直接作为 state 值
      expectedState = cookieStateRaw;
    }
  }

  if (!state || !expectedState || state !== expectedState) {
    return redirectToLogin(env, 'oauth_error=invalid_state');
  }

  // 4. 配置检查
  if (!env.ZHIHU_APP_ID || !env.ZHIHU_APP_KEY) {
    return redirectToLogin(env, 'oauth_error=not_configured');
  }

  try {
    // 5. 用 code 换取 access_token
    const redirectUri = `${env.PUBLIC_URL}/api/v1/auth/zhihu/callback`;
    const tokenResp = await exchangeCodeForToken({
      appId: env.ZHIHU_APP_ID,
      appKey: env.ZHIHU_APP_KEY,
      code,
      redirectUri,
    });

    // 6. 获取知乎用户信息
    const zhihuUser = await fetchZhihuUser(tokenResp.access_token);
    const providerUid = String(zhihuUser.uid);

    // 7. 查找已有的 OAuth 绑定
    const existingConn = await env.DB.prepare(
      'SELECT * FROM oauth_connections WHERE provider = ? AND provider_uid = ?'
    ).bind('zhihu', providerUid).first<DbOAuthConnection>();

    let userId: number;
    let dbUser: DbUser;

    if (existingConn) {
      // 7a. 已绑定 → 直接登录，更新 token
      await env.DB.prepare(
        `UPDATE oauth_connections SET access_token = ?, token_expires = ?, provider_info = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(
        tokenResp.access_token,
        new Date(Date.now() + tokenResp.expires_in * 1000).toISOString(),
        JSON.stringify(zhihuUser),
        existingConn.id,
      ).run();

      userId = existingConn.user_id;
      dbUser = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>())!;
    } else {
      // 7b. 未绑定 → 创建新用户 + 绑定关系
      const username = `zhihu_${providerUid}`;
      const email = zhihuUser.email || `${username}@${OAUTH_PLACEHOLDER_EMAIL_DOMAIN}`;
      const phone = zhihuUser.phone_no || '';
      const displayName = zhihuUser.fullname || username;
      const avatar = zhihuUser.avatar_path || getAvatarUrl(email);
      const emailVerified = zhihuUser.email ? 1 : 0;

      // 检查用户名是否冲突（极端情况：手动注册了 zhihu_xxx 用户名）
      const usernameConflict = await env.DB.prepare(
        'SELECT id FROM users WHERE username = ?'
      ).bind(username).first();
      const finalUsername = usernameConflict ? `zhihu_${providerUid}_${Date.now()}` : username;

      // 检查占位邮箱是否冲突
      const emailConflict = await env.DB.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).bind(email).first();
      const finalEmail = emailConflict ? `${finalUsername}@${OAUTH_PLACEHOLDER_EMAIL_DOMAIN}` : email;

      // 生成不可用密码（OAuth 用户无需密码登录）
      const randomPassword = generateToken();
      const { hashPassword } = await import('../../../../../lib/crypto');
      const passwordHash = await hashPassword(randomPassword);

      const result = await env.DB.prepare(
        `INSERT INTO users (username, display_name, email, phone, password_hash, avatar, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(finalUsername, displayName, finalEmail, phone, passwordHash, avatar, emailVerified).run();

      userId = result.meta.last_row_id as number;

      // 创建 OAuth 绑定
      await env.DB.prepare(
        `INSERT INTO oauth_connections (user_id, provider, provider_uid, access_token, token_expires, provider_info) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(
        userId,
        'zhihu',
        providerUid,
        tokenResp.access_token,
        new Date(Date.now() + tokenResp.expires_in * 1000).toISOString(),
        JSON.stringify(zhihuUser),
      ).run();

      dbUser = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>())!;
    }

    // 8. 更新最后登录时间
    await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(userId).run();

    // 9. 签发双 Token
    const accessToken = await signAccessToken({
      userId: dbUser.id,
      username: dbUser.username,
      role: dbUser.role,
    }, env);

    const refreshToken = generateToken();
    const refreshTokenHash = await hashToken(refreshToken);
    const refreshExpiry = getRefreshTokenExpiry();
    const expiresAt = new Date(Date.now() + refreshExpiry * 1000).toISOString();

    await env.DB.prepare(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)`
    ).bind(userId, refreshTokenHash, expiresAt).run();

    // 10. 302 重定向前端页面（Access Token 放 URL fragment，Refresh Token 放 Cookie）
    const redirectUrl = savedRedirect || DEFAULT_REDIRECT_URL;
    const separator = redirectUrl.includes('#') ? '&' : '#';

    const resp = new Response(null, {
      status: 302,
      headers: {
        Location: `${redirectUrl}${separator}access_token=${accessToken}`,
      },
    });
    resp.headers.append('Set-Cookie', `refresh_token=${refreshToken}; HttpOnly; Secure; SameSite=None; Path=/api/v1/auth; Max-Age=${refreshExpiry}`);
    resp.headers.append('Set-Cookie', `zhihu_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/zhihu/callback; Max-Age=0`);
    return resp;
  } catch (err) {
    const message = err instanceof Error ? err.message : '知乎授权失败';
    console.error('知乎 OAuth 回调错误:', message);
    return redirectToLogin(env, `oauth_error=${encodeURIComponent(message)}`);
  }
};

/** 从 Cookie 中获取指定值 */
function getCookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

/** 重定向到登录页面并携带错误信息 */
function redirectToLogin(env: Env, hashFragment: string): Response {
  const loginUrl = `${env.PUBLIC_URL}/login.html#${hashFragment}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: loginUrl,
      'Set-Cookie': `zhihu_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/zhihu/callback; Max-Age=0`,
    },
  });
}
