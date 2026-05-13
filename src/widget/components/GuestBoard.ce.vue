<!-- src/widget/components/GuestBoard.ce.vue — 留言板主容器（Web Component） -->
<template>
  <div class="gb-container">
    <!-- 头部：标题 + 用户栏 -->
    <div class="gb-header">
      <h2 class="gb-title">{{ config?.siteName || '留言板' }}</h2>
      <div v-if="auth.user.value" class="gb-user-bar">
        <UserDropdown
          :user="auth.user.value"
          @change-display-name="openAuthModal('change-display-name')"
          @change-password="openAuthModal('change-password')"
          @change-email="openAuthModal('change-email')"
          @logout="onLogout"
        />
      </div>
    </div>

    <!-- 未登录：登录/注册按钮 -->
    <div v-if="!auth.user.value" class="gb-auth-prompt">
      <span class="gb-auth-hint">登录后即可留言</span>
      <button class="gb-btn gb-btn-primary gb-btn-sm" @click="openAuthModal('login')">登录</button>
      <button v-if="config?.allowRegistration !== false" class="gb-btn gb-btn-outline gb-btn-sm" @click="openAuthModal('register')">注册</button>
    </div>

    <!-- 已登录但邮箱未验证：提示区 -->
    <div v-if="auth.user.value && !auth.user.value.emailVerified && auth.user.value.role !== 'admin'" class="gb-verify-prompt">
      <div class="gb-verify-text">⚠️ 请先验证邮箱才能留言</div>
      <div class="gb-verify-email">📧 当前邮箱：{{ maskEmail(auth.user.value.email) }}</div>
      <div class="gb-verify-actions">
        <button class="gb-btn gb-btn-sm gb-btn-outline" :disabled="resendLoading" @click="handleResendVerification">
          {{ resendLoading ? '发送中...' : '重发验证邮件' }}
        </button>
        <button class="gb-btn gb-btn-sm gb-btn-outline" @click="openAuthModal('change-email')">修改邮箱</button>
      </div>
    </div>

    <!-- 已登录且邮箱已验证（或管理员）：留言输入 -->
    <MessageForm
      v-if="auth.user.value && (auth.user.value.emailVerified || auth.user.value.role === 'admin')"
      :api-base="resolvedApiBase"
      :page-id="pageId"
      :site-key="resolvedSiteKey"
      :min-length="minLength"
      :max-length="maxLength"
      :require-captcha="effectiveRequireCaptcha"
      :messages="messages"
      :current-user="auth.user.value"
    />

    <!-- 留言列表 -->
    <MessageList
      :messages="messages.messages.value"
      :loading="messages.loading.value"
      :current-user="auth.user.value"
      :messages-composable="messages"
      :page-id="pageId"
      :min-length="minLength"
      :max-length="maxLength"
      :site-key="resolvedSiteKey"
      :require-captcha="effectiveRequireCaptcha"
    />

    <!-- 加载更多 -->
    <Pagination
      :has-more="messages.hasMore.value"
      :loading="messages.loading.value"
      @load-more="onLoadMore"
    />

    <!-- 版权信息 -->
    <div class="gb-footer">
      <span class="gb-copyright">
        &copy; <a href="https://www.17you.com/" target="_blank" rel="noopener noreferrer">自游人</a>
      </span>
      <span class="gb-version">v1.0.0</span>
    </div>

    <!-- 认证弹窗 -->
    <AuthModal
      ref="authModalRef"
      :site-key="resolvedSiteKey"
      :theme="effectiveTheme"
      :force-skip-turnstile="!!config?.forceSkipTurnstile"
      @close="onAuthModalClose"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue';
import { useAuth, initAuth } from '../composables/useAuth';
import { useMessages } from '../composables/useMessages';
import { useTheme } from '../composables/useTheme';
import { adoptTheme } from '../styles/theme';
import UserDropdown from './UserDropdown.vue';
import AuthModal from './AuthModal.vue';

type AuthModalMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'change-display-name' | 'change-password' | 'change-email';
import MessageForm from './MessageForm.vue';
import MessageList from './MessageList.vue';
import Pagination from './Pagination.vue';

const props = defineProps<{
  pageId: string;
  apiBase: string;
  siteKey?: string;
  theme?: 'light' | 'dark' | 'auto';
  maxLength?: number;
}>();

// 自动补全 apiBase
const resolvedApiBase = computed(() => {
  const base = props.apiBase.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : base + '/api/v1';
});

// 初始化认证单例
initAuth(resolvedApiBase.value);

const resolvedSiteKey = computed(() => config.value?.turnstileSiteKey || props.siteKey || '');
const maxLength = computed(() => config.value?.maxMessageLength || props.maxLength || 500);
const minLength = computed(() => config.value?.minMessageLength || 2);
// 紧急降级模式下不渲染验证码（forceSkipTurnstile 开启或未配置 siteKey 时跳过）
const effectiveRequireCaptcha = computed(() =>
  config.value?.requireCaptcha !== false && !config.value?.forceSkipTurnstile
);

const { effectiveTheme } = useTheme(props.theme || 'auto');

watch(effectiveTheme, (t) => {
  const el = (globalThis as any).__widget_host_el as HTMLElement;
  if (el) el.setAttribute('theme', t);
}, { immediate: true });

const auth = useAuth();
const messages = useMessages(resolvedApiBase.value);
const config = messages.config;

const authModalRef = ref<InstanceType<typeof AuthModal> | null>(null);
const resendLoading = ref(false);

function openAuthModal(mode: AuthModalMode) {
  authModalRef.value?.open(mode);
}

function onAuthModalClose() {
  // 弹窗关闭后无需额外处理，状态已由 useAuth 管理
}

async function onLogout() {
  // 退出登录由 UserDropdown 内部调用 auth.logout() 处理
}

async function handleResendVerification() {
  resendLoading.value = true;
  await auth.resendVerification();
  resendLoading.value = false;
}

function maskEmail(email: string): string {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const masked = local.length > 1 ? local[0] + '***' : local;
  return `${masked}@${domain}`;
}

function onLoadMore() {
  messages.loadMore(props.pageId);
}

onMounted(async () => {
  const el = getCurrentInstance()!.proxy!.$el as HTMLElement;
  adoptTheme(el.getRootNode() as ShadowRoot);
  await messages.fetchConfig();
  await messages.fetchMessages(props.pageId);
  await auth.init();
});
</script>

<style>
/* ===== GuestBoard 布局（通用样式由 theme.ts 通过 adoptedStyleSheets 提供） ===== */
:host {
  display: block;
  background: var(--gb-bg);
  border-radius: var(--gb-border-radius);
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 480px) {
  :host { border-radius: 0; }
}

.gb-container { padding: 20px; }
.gb-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}
.gb-title {
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  color: var(--gb-text);
  flex: 1;
}

/* 未登录提示 */
.gb-auth-prompt {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 14px 16px;
  background: var(--gb-bg-secondary);
  border-radius: var(--gb-border-radius);
}
.gb-auth-hint {
  color: var(--gb-text-secondary);
  font-size: 14px;
  margin-right: auto;
}

/* 用户栏 */
.gb-user-bar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* 邮箱未验证提示 */
.gb-verify-prompt {
  margin-bottom: 16px;
  padding: 12px 16px;
  background: rgba(243, 156, 18, 0.08);
  border: 1px solid rgba(243, 156, 18, 0.2);
  border-radius: var(--gb-border-radius);
}
.gb-verify-text {
  font-size: 14px;
  color: var(--gb-warning);
  font-weight: 500;
  margin-bottom: 4px;
}
.gb-verify-email {
  font-size: 12px;
  color: var(--gb-text-secondary);
  margin-bottom: 8px;
}
.gb-verify-actions {
  display: flex;
  gap: 8px;
}
</style>
