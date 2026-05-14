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

  // 调试：记录知乎回调的完整 URL 和参数
  console.log('[知乎 OAuth 回调] 完整 URL:', request.url);
  console.log('[知乎 OAuth 回调] search params:', Object.fromEntries(url.searchParams.entries()));
  console.log('[知乎 OAuth 回调] Cookie:', request.headers.get('Cookie') || '(none)');

  // 1. 检查知乎是否返回了错误（用户拒绝授权等）
  const errorParam = url.searchParams.get('error');
  if (errorParam) {
    const errorDesc = url.searchParams.get('error_description') || '授权失败';
    console.error('[知乎 OAuth 回调] 知乎返回错误:', errorParam, errorDesc);
    return redirectToLogin(env, `oauth_error=${encodeURIComponent(errorDesc)}`);
  }

  // 2. 验证 authorization_code 参数（知乎黑客松 OAuth 回调参数名为 authorization_code，而非 code）
  const code = url.searchParams.get('authorization_code') || url.searchParams.get('code');
  if (!code) {
    console.error('[知乎 OAuth 回调] 缺少 authorization_code 参数，收到的参数:', Object.fromEntries(url.searchParams.entries()));
    return redirectToLogin(env, `oauth_error=missing_code&debug_url=${encodeURIComponent(request.url)}`);
  }

  // 3. 从 Cookie 中读取 redirect 地址（知乎黑客松 OAuth 不回传 state，仅从 cookie 提取 redirect）
  const state = url.searchParams.get('state');
  const cookieStateRaw = getCookieValue(request, 'zhihu_oauth_state');
  let savedRedirect = '';

  if (cookieStateRaw) {
    try {
      const decoded = JSON.parse(decodeURIComponent(escape(atob(cookieStateRaw))));
      savedRedirect = decoded.r || '';
      // 知乎黑客松 OAuth 不回传 state，仅在有 state 时做校验
      const expectedState = decoded.s || '';
      if (state && expectedState && state !== expectedState) {
        return redirectToLogin(env, 'oauth_error=invalid_state');
      }
    } catch {
      // 旧格式兼容
    }
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
      // 7a. 已绑定 → 直接登录，更新 token 和用户资料（知乎返回的最新 email/phone/avatar 可能变化）
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

      /**
       * 同步知乎最新资料到 users 表
       * 策略：仅在有值时更新（知乎未返回则保留本地值），email/phone 需检查 UNIQUE 冲突
       */
      const userUpdates: string[] = [];
      const userBinds: unknown[] = [];

      if (zhihuUser.fullname && zhihuUser.fullname !== dbUser.display_name) {
        userUpdates.push('display_name = ?');
        userBinds.push(zhihuUser.fullname);
      }
      if (zhihuUser.avatar_path && zhihuUser.avatar_path !== dbUser.avatar) {
        userUpdates.push('avatar = ?');
        userBinds.push(zhihuUser.avatar_path);
      }
      if (zhihuUser.email && zhihuUser.email !== dbUser.email) {
        const emailConflict = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id != ?').bind(zhihuUser.email, userId).first();
        if (!emailConflict) {
          userUpdates.push('email = ?', 'email_verified = 1');
          userBinds.push(zhihuUser.email);
        }
      }
      if (zhihuUser.phone_no && zhihuUser.phone_no !== dbUser.phone) {
        const phoneConflict = await env.DB.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(zhihuUser.phone_no, userId).first();
        if (!phoneConflict) {
          userUpdates.push('phone = ?');
          userBinds.push(zhihuUser.phone_no);
        }
      }

      if (userUpdates.length > 0) {
        userUpdates.push('updated_at = datetime("now")');
        userBinds.push(userId);
        await env.DB.prepare(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`).bind(...userBinds).run();
        dbUser = (await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<DbUser>())!;
      }
    } else {
      // 7b. 未绑定 → 检查知乎是否返回了有效的 email 和 phone_no
      const hasEmail = !!zhihuUser.email;
      const hasPhone = !!zhihuUser.phone_no;

      if (hasEmail && hasPhone) {
        // 7b-1. 知乎返回了完整信息 → 直接注册
        const baseUsername = zhihuUser.fullname || `zhihu_${providerUid}`;
        const displayName = baseUsername;
        const avatar = zhihuUser.avatar_path || getAvatarUrl(zhihuUser.email);
        const emailVerified = 1;

        /**
         * 用户名冲突检查：
         * 若 fullname 与已有用户冲突，追加 uid 后缀确保唯一
         */
        const usernameConflict = await env.DB.prepare(
          'SELECT id FROM users WHERE username = ?'
        ).bind(baseUsername).first();
        const finalUsername = usernameConflict ? `${baseUsername}_${providerUid}` : baseUsername;

        /**
         * 邮箱冲突检查：
         * 真实邮箱被占用 → 追加 uid 后缀的占位邮箱
         */
        let finalEmail = zhihuUser.email;
        const emailConflict = await env.DB.prepare(
          'SELECT id FROM users WHERE email = ?'
        ).bind(finalEmail).first();
        if (emailConflict) {
          finalEmail = `${finalUsername}_${providerUid}@${OAUTH_PLACEHOLDER_EMAIL_DOMAIN}`;
        }

        /**
         * phone UNIQUE 冲突处理：
         * phone 非空但已被占用 → 降级为唯一占位符
         */
        let finalPhone = zhihuUser.phone_no;
        const phoneConflict = await env.DB.prepare(
          'SELECT id FROM users WHERE phone = ?'
        ).bind(finalPhone).first();
        if (phoneConflict) {
          finalPhone = `_phone_${providerUid}`;
        }

        // 生成不可用密码（OAuth 用户无需密码登录）
        const randomPassword = generateToken();
        const { hashPassword } = await import('../../../../../lib/crypto');
        const passwordHash = await hashPassword(randomPassword);

        const result = await env.DB.prepare(
          `INSERT INTO users (username, display_name, email, phone, password_hash, avatar, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(finalUsername, displayName, finalEmail, finalPhone, passwordHash, avatar, emailVerified).run();

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
      } else {
        // 7b-2. 知乎未返回 email 或 phone_no → 跳转注册页面，预填知乎信息
        console.log('[知乎 OAuth 回调] 知乎未返回完整信息，跳转注册页面:', { hasEmail, hasPhone });
        return redirectToRegister(env, savedRedirect, {
          uid: zhihuUser.uid,
          fullname: zhihuUser.fullname,
          email: zhihuUser.email,
          phone_no: zhihuUser.phone_no,
          avatar_path: zhihuUser.avatar_path,
        });
      }
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

/**
 * 重定向到注册页面，携带知乎预填信息
 * @param env - 环境变量
 * @param redirect - 登录后的重定向地址
 * @param zhihuInfo - 知乎用户信息（uid, fullname, email, phone_no, avatar_path）
 */
function redirectToRegister(env: Env, redirect: string, zhihuInfo: {
  uid: number;
  fullname: string;
  email: string;
  phone_no: string;
  avatar_path: string;
}): Response {
  const params = new URLSearchParams();
  params.set('zhihu_uid', String(zhihuInfo.uid));
  if (zhihuInfo.fullname) params.set('zhihu_name', zhihuInfo.fullname);
  if (zhihuInfo.email) params.set('zhihu_email', zhihuInfo.email);
  if (zhihuInfo.phone_no) params.set('zhihu_phone', zhihuInfo.phone_no);
  if (zhihuInfo.avatar_path) params.set('zhihu_avatar', zhihuInfo.avatar_path);
  if (redirect) params.set('redirect', redirect);

  const registerUrl = `${env.PUBLIC_URL}/login.html#register?${params.toString()}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: registerUrl,
      'Set-Cookie': `zhihu_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/zhihu/callback; Max-Age=0`,
    },
  });
}
