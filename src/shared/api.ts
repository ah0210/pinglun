// src/shared/api.ts — API 请求封装（含双 Token 自动刷新）

import type { ApiResponse, PaginatedResponse, PublicUser } from './types';

const TOKEN_KEY = 'guestbook_access_token';

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    accessToken = stored;
    return stored;
  }
  return null;
}

export function clearAuth() {
  accessToken = null;
  localStorage.removeItem(TOKEN_KEY);
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(apiBase: string): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const resp = await fetch(`${apiBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // 发送 Cookie
      });

      if (!resp.ok) {
        clearAuth();
        return false;
      }

      const data: ApiResponse<{ accessToken: string; user: PublicUser }> = await resp.json();
      if (data.success && data.data) {
        setAccessToken(data.data.accessToken);
        return true;
      }

      clearAuth();
      return false;
    } catch {
      clearAuth();
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest<T>(
  apiBase: string,
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 跨域 Widget 场景下必须用 'include'，确保：
  // 1. 浏览器发送 refresh_token Cookie（refresh/logout 请求）
  // 2. 后端 Set-Cookie 指令生效（登录/注册设置 refresh_token）
  // 3. CORS 预检请求正确处理
  const credentials = 'include';

  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials,
  });

  // 防护：如果响应不是 JSON（如 Cloudflare 返回 HTML 错误页），避免 JSON.parse 崩溃
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { success: false, error: { code: -1, message: `请求失败：收到非 JSON 响应 (${resp.status})` } } as ApiResponse<T>;
  }

  const data = await resp.json() as ApiResponse<T>;

  // Token 过期，自动刷新
  if (resp.status === 401 && data.error?.code === 1002) {
    const refreshed = await refreshAccessToken(apiBase);
    if (refreshed) {
      // 用新 token 重试
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResp = await fetch(`${apiBase}${path}`, {
        ...options,
        headers,
        credentials,
      });
      return retryResp.json() as Promise<ApiResponse<T>>;
    }
  }

  return data;
}

/** GET 请求 */
export async function apiGet<T>(apiBase: string, path: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(apiBase, path, { method: 'GET' });
}

/** POST 请求 */
export async function apiPost<T>(apiBase: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(apiBase, path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** PATCH 请求 */
export async function apiPatch<T>(apiBase: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
  return apiRequest<T>(apiBase, path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** DELETE 请求 */
export async function apiDelete<T>(apiBase: string, path: string): Promise<ApiResponse<T>> {
  return apiRequest<T>(apiBase, path, { method: 'DELETE' });
}
