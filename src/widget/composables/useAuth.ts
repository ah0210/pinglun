// src/widget/composables/useAuth.ts — 认证状态管理

import { ref, computed } from 'vue';
import { apiPost, apiGet, setAccessToken, getAccessToken, clearAuth } from '../../shared/api';
import type { PublicUser } from '../../shared/types';

const user = ref<PublicUser | null>(null);
const loading = ref(false);

export function useAuth(apiBase: string) {
  const isLoggedIn = computed(() => !!user.value);
  const isAdmin = computed(() => user.value?.role === 'admin');

  async function init() {
    const token = getAccessToken();
    if (!token) return;

    try {
      const resp = await apiGet<PublicUser>(apiBase, '/auth/me');
      if (resp.success && resp.data) {
        user.value = resp.data;
      } else {
        clearAuth();
      }
    } catch {
      clearAuth();
    }
  }

  async function login(login: string, password: string, turnstileToken: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ accessToken: string; user: PublicUser }>(apiBase, '/auth/login', {
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

  async function register(username: string, email: string, password: string, turnstileToken: string) {
    loading.value = true;
    try {
      const resp = await apiPost<{ accessToken: string; user: PublicUser }>(apiBase, '/auth/register', {
        username,
        email,
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
      await apiPost(apiBase, '/auth/logout');
    } finally {
      clearAuth();
      user.value = null;
    }
  }

  async function updateProfile(data: { displayName?: string; bio?: string }) {
    const resp = await apiPatch<PublicUser>(apiBase, '/auth/me', data);
    if (resp.success && resp.data) {
      user.value = resp.data;
    }
    return resp;
  }

  return {
    user,
    loading,
    isLoggedIn,
    isAdmin,
    init,
    login,
    register,
    logout,
    updateProfile,
  };
}
