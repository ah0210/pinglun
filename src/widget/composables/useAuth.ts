// src/widget/composables/useAuth.ts — 认证状态管理（模块级单例）

import { ref, computed } from 'vue';
import { apiPost, apiGet, apiPatch, setAccessToken, getAccessToken, clearAuth } from '../../shared/api';
import type { PublicUser } from '../../shared/types';

// ===== 模块级单例状态 =====
const user = ref<PublicUser | null>(null);
const loading = ref(false);
let _apiBase = '';

/** 初始化 apiBase（由 GuestBoard 或 AuthBar 首次调用时设置） */
export function initAuth(apiBase: string) {
  if (!_apiBase) {
    _apiBase = apiBase;
  }
}

export function useAuth() {
  const isLoggedIn = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');
  const isEmailVerified = computed(() => user.value?.emailVerified === true);

  async function init() {
    if (!_apiBase) return;
    const token = getAccessToken();

    if (token) {
      try {
        const resp = await apiGet<PublicUser>(_apiBase, '/auth/me');
        if (resp.success && resp.data) {
          user.value = resp.data;
          return;
        }
      } catch { /* fall through to refresh */ }
      clearAuth();
    }

    try {
      const resp = await fetch(`${_apiBase}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (resp.ok) {
        const data = await resp.json() as { success: boolean; data?: { accessToken: string; user: PublicUser } };
        if (data.success && data.data) {
          setAccessToken(data.data.accessToken);
          user.value = data.data.user;
          return;
        }
      }
    } catch { /* ignore */ }

    clearAuth();
  }

  async function login(login: string, password: string, turnstileToken: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ accessToken: string; user: PublicUser }>(_apiBase, '/auth/login', {
        login,
        password,
        turnstileToken,
      });

      if (resp.success && resp.data) {
        setAccessToken(resp.data.accessToken);
        user.value = resp.data.user;
        return { success: true };
      }

      return { success: false, error: resp.error };
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  async function register(username: string, email: string, phone: string, password: string, turnstileToken: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ accessToken: string; user: PublicUser }>(_apiBase, '/auth/register', {
        username,
        email,
        phone,
        password,
        turnstileToken,
      });

      if (resp.success && resp.data) {
        setAccessToken(resp.data.accessToken);
        user.value = resp.data.user;
        return { success: true };
      }

      return { success: false, error: resp.error };
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  async function logout() {
    try {
      await apiPost(_apiBase, '/auth/logout');
    } finally {
      clearAuth();
      user.value = null;
    }
  }

  async function updateProfile(data: { displayName?: string; bio?: string }) {
    const resp = await apiPatch<PublicUser>(_apiBase, '/auth/me', data);
    if (resp.success && resp.data) {
      user.value = resp.data;
    }
    return resp;
  }

  async function forgotPassword(email: string, turnstileToken: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ message: string }>(_apiBase, '/auth/forgot-password', {
        email,
        turnstileToken,
      });
      return resp;
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  async function resetPassword(token: string, newPassword: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ message: string }>(_apiBase, '/auth/reset-password', {
        token,
        newPassword,
      });
      return resp;
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ message: string }>(_apiBase, '/auth/change-password', {
        currentPassword,
        newPassword,
      });
      if (resp.success) {
        // 密码修改成功，需重新登录
        clearAuth();
        user.value = null;
      }
      return resp;
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  async function changeEmail(newEmail: string, currentPassword: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ message: string; user?: PublicUser }>(_apiBase, '/auth/change-email', {
        newEmail,
        currentPassword,
      });
      if (resp.success && resp.data?.user) {
        user.value = resp.data.user;
      }
      return resp;
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  /** 跳转知乎 OAuth 授权页 */
  function loginWithZhihu() {
    if (!_apiBase) return;
    window.location.href = `${_apiBase}/auth/zhihu`;
  }

  /** 处理 OAuth 回调（从 URL fragment 中提取 access_token） */
  async function handleOAuthCallback(): Promise<boolean> {
    const hash = window.location.hash;
    if (!hash) return false;

    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    if (!accessToken) return false;

    setAccessToken(accessToken);

    // 清理 URL hash
    if (window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    try {
      const resp = await apiGet<PublicUser>(_apiBase, '/auth/me');
      if (resp.success && resp.data) {
        user.value = resp.data;
        return true;
      }
    } catch { /* ignore */ }

    clearAuth();
    return false;
  }

  async function resendVerification() {
    loading.value = true;
    try {
      const resp = await apiPost<{ message: string }>(_apiBase, '/auth/resend-verification');
      return resp;
    } catch (e: any) {
      return { success: false, error: { code: 0, message: e.message } };
    } finally {
      loading.value = false;
    }
  }

  return {
    user,
    loading,
    isLoggedIn,
    isAdmin,
    isEmailVerified,
    init,
    login,
    register,
    logout,
    updateProfile,
    forgotPassword,
    resetPassword,
    changePassword,
    changeEmail,
    resendVerification,
    loginWithZhihu,
    handleOAuthCallback,
  };
}
