// src/admin/stores/auth.ts — Pinia 认证状态管理
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { PublicUser } from '../../shared/types';

const API_BASE = '/api/v1';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<PublicUser | null>(null);
  const token = ref<string | null>(localStorage.getItem('admin_token'));

  const isLoggedIn = computed(() => !!user.value && !!token.value);

  function setAuth(accessToken: string, userData: PublicUser) {
    token.value = accessToken;
    user.value = userData;
    localStorage.setItem('admin_token', accessToken);
  }

  function clearAuth() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('admin_token');
  }

  async function init() {
    if (!token.value) return;

    try {
      const resp = await fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token.value}` },
        credentials: 'include',
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.data) {
          user.value = data.data;
          if (data.data.role !== 'admin') {
            clearAuth();
          }
        } else {
          clearAuth();
        }
      } else {
        // 尝试刷新 token
        const refreshed = await refreshToken();
        if (!refreshed) clearAuth();
      }
    } catch {
      clearAuth();
    }
  }

  async function refreshToken(): Promise<boolean> {
    try {
      const resp = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!resp.ok) return false;

      const data = await resp.json();
      if (data.success && data.data) {
        setAuth(data.data.accessToken, data.data.user);
        return data.data.user.role === 'admin';
      }

      return false;
    } catch {
      return false;
    }
  }

  async function login(login: string, password: string, turnstileToken: string) {
    const resp = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ login, password, turnstileToken }),
    });

    const data = await resp.json();

    if (data.success && data.data) {
      if (data.data.user.role !== 'admin') {
        return { success: false, error: { code: 4001, message: '需要管理员权限' } };
      }
      setAuth(data.data.accessToken, data.data.user);
      return { success: true };
    }

    return { success: false, error: data.error };
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: token.value ? { 'Authorization': `Bearer ${token.value}` } : {},
      });
    } finally {
      clearAuth();
    }
  }

  return { user, token, isLoggedIn, init, login, logout, setAuth, clearAuth };
});
