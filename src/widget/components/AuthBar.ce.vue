<!-- src/widget/components/AuthBar.ce.vue — 导航栏认证栏 Web Component -->
<template>
  <div class="gb-authbar">
    <!-- 未登录 -->
    <div v-if="!auth.user.value" class="gb-authbar-guest">
      <button class="gb-btn gb-btn-primary gb-btn-sm" @click="openAuth('login')">登录</button>
      <button class="gb-btn gb-btn-outline gb-btn-sm" @click="openAuth('register')">注册</button>
    </div>

    <!-- 已登录 -->
    <UserDropdown
      v-if="auth.user.value"
      :user="auth.user.value"
      @change-display-name="openAuth('change-display-name')"
      @change-password="openAuth('change-password')"
      @change-email="openAuth('change-email')"
      @logout="auth.logout()"
    />

    <!-- 认证弹窗 -->
    <AuthModal
      ref="authModalRef"
      :site-key="siteKey"
      :theme="effectiveTheme"
      @close="onAuthModalClose"
    />
  </div>
</template>

<script lang="ts" setup>
import { getCurrentInstance, onMounted, ref, watch } from 'vue';
import { useAuth, initAuth } from '../composables/useAuth';
import { useTheme } from '../composables/useTheme';
import { adoptTheme } from '../styles/theme';
import UserDropdown from './UserDropdown.vue';
import AuthModal from './AuthModal.vue';

type AuthModalMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'change-display-name' | 'change-password' | 'change-email';

const props = defineProps<{
  apiBase: string;
  siteKey?: string;
  theme?: 'light' | 'dark' | 'auto';
  showEmail?: boolean;
  showVerifiedStatus?: boolean;
  avatarSize?: number;
}>();

const apiBase = props.apiBase.replace(/\/+$/, '');
const resolvedApiBase = apiBase.endsWith('/api/v1') ? apiBase : apiBase + '/api/v1';
const siteKey = props.siteKey || '';

initAuth(resolvedApiBase);

const { effectiveTheme } = useTheme(props.theme || 'auto');

watch(effectiveTheme, (t) => {
  const el = getCurrentInstance()?.proxy?.$el as HTMLElement | undefined;
  if (el) el.setAttribute('theme', t);
}, { immediate: true });

const auth = useAuth();
const authModalRef = ref<InstanceType<typeof AuthModal> | null>(null);

function openAuth(mode: AuthModalMode) {
  authModalRef.value?.open(mode);
}

function onAuthModalClose() {
  // 状态由 useAuth 管理
}

onMounted(() => {
  const el = getCurrentInstance()!.proxy!.$el as HTMLElement;
  adoptTheme(el.getRootNode() as ShadowRoot);
  auth.init();
});
</script>

<style>
/* ===== AuthBar 布局（通用样式由 theme.ts 通过 adoptedStyleSheets 提供） ===== */
:host {
  display: inline-block;
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
</style>
