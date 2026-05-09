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

  // 大多数请求不需要发送 Cookie（用 Bearer token 认证）
  // 只有 refresh 请求需要 credentials: 'include' 发送 httpOnly Cookie
  const needCredentials = (options as any).credentials === 'include';
  const credentials = needCredentials ? 'include' : 'same-origin';

  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
    credentials,
  });

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
