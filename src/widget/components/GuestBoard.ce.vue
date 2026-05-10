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
      :require-captcha="config?.requireCaptcha !== false"
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
      :require-captcha="config?.requireCaptcha !== false"
    />

    <!-- 分页 -->
    <Pagination
      v-if="messages.totalPages.value > 1"
      :current="messages.page.value"
      :total="messages.totalPages.value"
      @change="onPageChange"
    />

    <!-- 认证弹窗 -->
    <AuthModal
      ref="authModalRef"
      :site-key="resolvedSiteKey"
      @close="onAuthModalClose"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useAuth, initAuth } from '../composables/useAuth';
import { useMessages } from '../composables/useMessages';
import { useTheme } from '../composables/useTheme';
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

onMounted(async () => {
  await messages.fetchConfig();
  await messages.fetchMessages(props.pageId);
  await auth.init();
});
</script>

<style>
/* 主题变量 */
:host {
  --gb-primary: var(--guestbook-primary, #4a6cf7);
  --gb-primary-hover: var(--guestbook-primary-hover, #3b5de7);
  --gb-bg: var(--guestbook-bg, #ffffff);
  --gb-bg-secondary: var(--guestbook-bg-secondary, #f7f8fa);
  --gb-text: var(--guestbook-text, #333333);
  --gb-text-secondary: var(--guestbook-text-secondary, #666666);
  --gb-border: var(--guestbook-border, #e0e0e0);
  --gb-border-radius: var(--guestbook-border-radius, 8px);
  --gb-shadow: var(--guestbook-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  --gb-font-size: var(--guestbook-font-size, 14px);
  --gb-font-family: var(--guestbook-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  --gb-danger: #e74c3c;
  --gb-success: #27ae60;
  --gb-warning: #f39c12;

  display: block;
  font-family: var(--gb-font-family);
  font-size: var(--gb-font-size);
  color: var(--gb-text);
  background: var(--gb-bg);
  border-radius: var(--gb-border-radius);
  max-width: 800px;
  margin: 0 auto;
}

:host([theme="dark"]) {
  --gb-bg: var(--guestbook-bg, #1a1a2e);
  --gb-bg-secondary: var(--guestbook-bg-secondary, #16213e);
  --gb-text: var(--guestbook-text, #e0e0e0);
  --gb-text-secondary: var(--guestbook-text-secondary, #a0a0a0);
  --gb-border: var(--guestbook-border, #2d2d44);
  --gb-shadow: var(--guestbook-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
}

/* 通用 */
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

/* 按钮 */
.gb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: var(--gb-border-radius);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.gb-btn-primary { background: var(--gb-primary); color: #fff; }
.gb-btn-primary:active { background: var(--gb-primary-hover); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-outline { background: transparent; color: var(--gb-primary); border: 1px solid var(--gb-primary); }
.gb-btn-outline:active { background: var(--gb-bg-secondary); }
.gb-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-sm { padding: 5px 12px; font-size: 13px; min-height: 44px; }

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

/* 留言列表 */
.gb-message-list { list-style: none; padding: 0; margin: 0; }
.gb-message-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--gb-border);
}
.gb-message-item:last-child { border-bottom: none; }

.gb-message-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.gb-avatar {
  width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
  background: var(--gb-bg-secondary);
}
.gb-message-meta { flex: 1; }
.gb-username { font-weight: 500; color: var(--gb-text); }
.gb-time { font-size: 12px; color: var(--gb-text-secondary); margin-left: 8px; }
.gb-secret-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--gb-warning);
  color: #fff;
  margin-left: 6px;
}
.gb-admin-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: var(--gb-primary);
  color: #fff;
  margin-left: 6px;
}

.gb-message-content {
  margin: 0;
  line-height: 1.6;
  word-break: break-word;
  color: var(--gb-text);
}
.gb-secret-placeholder {
  color: var(--gb-text-secondary);
  font-style: italic;
}

/* 回复引用块 */
.gb-reply-quote {
  margin-bottom: 8px;
  padding: 8px 12px;
  border-left: 3px solid var(--gb-primary);
  background: var(--gb-bg-secondary);
  border-radius: 0 var(--gb-border-radius) var(--gb-border-radius) 0;
  font-size: 13px;
  line-height: 1.5;
}
.gb-reply-quote-user {
  color: var(--gb-primary);
  font-weight: 500;
  margin-right: 4px;
}
.gb-reply-quote-content {
  color: var(--gb-text-secondary);
}

/* 回复按钮 */
.gb-message-actions {
  margin-top: 6px;
}
.gb-btn-reply {
  background: none;
  border: none;
  color: var(--gb-text-secondary);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.gb-btn-reply:active {
  color: var(--gb-primary);
}

/* 内联回复表单 */
.gb-inline-reply {
  margin-top: 10px;
  padding: 12px;
  background: var(--gb-bg-secondary);
  border-radius: var(--gb-border-radius);
}
.gb-reply-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0 8px;
  font-size: 13px;
  color: var(--gb-primary);
}
.gb-reply-textarea {
  min-height: 60px;
}
.gb-inline-reply-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

/* 分页 */
.gb-pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; }
.gb-page-btn {
  padding: 6px 12px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius);
  background: var(--gb-bg);
  color: var(--gb-text);
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-page-btn:active { border-color: var(--gb-primary); color: var(--gb-primary); }
.gb-page-btn.active { background: var(--gb-primary); color: #fff; border-color: var(--gb-primary); }
.gb-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 空状态 */
.gb-empty { text-align: center; padding: 40px 20px; color: var(--gb-text-secondary); }

/* Loading */
.gb-loading { text-align: center; padding: 20px; color: var(--gb-text-secondary); }

/* 状态标签 */
.gb-status-pending { color: var(--gb-warning); font-size: 12px; }
.gb-status-approved { color: var(--gb-success); font-size: 12px; }

/* 移动端适配 */
@media (max-width: 480px) {
  .gb-container { padding: 12px; }

  .gb-header {
    flex-wrap: wrap;
    gap: 8px;
  }
  .gb-title {
    font-size: 18px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gb-auth-prompt {
    flex-wrap: wrap;
    padding: 10px 12px;
  }
  .gb-auth-hint { font-size: 13px; }

  .gb-verify-actions {
    flex-wrap: wrap;
  }

  .gb-message-header {
    gap: 8px;
  }
  .gb-message-meta {
    min-width: 0;
    overflow: hidden;
  }
  .gb-username {
    display: inline-block;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
  }
  .gb-time {
    display: block;
    margin-left: 0;
    margin-top: 2px;
  }

  .gb-inline-reply-actions {
    flex-wrap: wrap;
  }

  .gb-pagination {
    flex-wrap: wrap;
  }
  .gb-page-btn {
    padding: 5px 8px;
    font-size: 12px;
  }
}

/* 桌面端 hover 效果（移动端不应用，避免双击问题） */
@media (hover: hover) {
  .gb-btn-primary:hover { background: var(--gb-primary-hover); }
  .gb-btn-outline:hover { background: var(--gb-bg-secondary); }
  .gb-btn-reply:hover { color: var(--gb-primary); }
  .gb-page-btn:hover { border-color: var(--gb-primary); color: var(--gb-primary); }
}
</style>
