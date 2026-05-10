<!-- src/widget/components/AuthBar.ce.vue — 导航栏认证栏 Web Component -->
<template>
  <div class="gb-authbar">
    <!-- 未登录 -->
    <div v-if="!auth.user.value" class="gb-authbar-guest">
      <button class="gb-authbar-btn gb-authbar-btn-primary" @click="openAuth('login')">登录</button>
      <button class="gb-authbar-btn gb-authbar-btn-outline" @click="openAuth('register')">注册</button>
    </div>

    <!-- 已登录 -->
    <UserDropdown
      v-if="auth.user.value"
      :user="auth.user.value"
      @change-password="openAuth('change-password')"
      @change-email="openAuth('change-email')"
      @logout="auth.logout()"
    />

    <!-- 认证弹窗 -->
    <AuthModal
      ref="authModalRef"
      :site-key="siteKey"
      @close="onAuthModalClose"
    />
  </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue';
import { useAuth, initAuth } from '../composables/useAuth';
import UserDropdown from './UserDropdown.vue';
import AuthModal from './AuthModal.vue';

type AuthModalMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'change-password' | 'change-email';

const props = defineProps<{
  apiBase: string;
  siteKey?: string;
  showEmail?: boolean;
  showVerifiedStatus?: boolean;
  avatarSize?: number;
}>();

const apiBase = props.apiBase.replace(/\/+$/, '');
const resolvedApiBase = apiBase.endsWith('/api/v1') ? apiBase : apiBase + '/api/v1';
const siteKey = props.siteKey || '';

initAuth(resolvedApiBase);

const auth = useAuth();
const authModalRef = ref<InstanceType<typeof AuthModal> | null>(null);

function openAuth(mode: AuthModalMode) {
  authModalRef.value?.open(mode);
}

function onAuthModalClose() {
  // 状态由 useAuth 管理
}

onMounted(async () => {
  await auth.init();
});
</script>

<style>
/* AuthBar 自身的 Shadow DOM 样式 */
:host {
  display: inline-block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

.gb-authbar {
  display: flex;
  align-items: center;
}

.gb-authbar-guest {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gb-authbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.gb-authbar-btn-primary {
  background: #4a6cf7;
  color: #fff;
}
.gb-authbar-btn-primary:hover { background: #3b5de7; }

.gb-authbar-btn-outline {
  background: transparent;
  color: #4a6cf7;
  border: 1px solid #4a6cf7;
}
.gb-authbar-btn-outline:hover { background: #f0f3ff; }
</style>
