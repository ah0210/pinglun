<!-- src/widget/components/GuestBoard.ce.vue — 留言板主容器（Web Component） -->
<template>
  <div class="gb-container">
    <h2 class="gb-title">{{ config?.siteName || '留言板' }}</h2>

    <!-- 用户状态栏 -->
    <div v-if="auth.user.value" class="gb-user-bar">
      <div class="gb-user-info">
        <img :src="auth.user.value.avatar" class="gb-avatar" :alt="auth.user.value.displayName" />
        <span class="gb-user-name">{{ auth.user.value.displayName }}</span>
        <span v-if="auth.user.value.role === 'admin'" class="gb-admin-badge">管理员</span>
      </div>
      <button class="gb-btn gb-btn-text" @click="auth.logout()">退出</button>
    </div>

    <!-- 认证表单 -->
    <LoginForm
      v-if="!auth.user.value"
      :api-base="resolvedApiBase"
      :site-key="resolvedSiteKey"
      :auth="auth"
      :allow-registration="config?.allowRegistration !== false"
    />

    <!-- 留言输入 -->
    <MessageForm
      v-if="auth.user.value"
      :api-base="resolvedApiBase"
      :page-id="pageId"
      :site-key="resolvedSiteKey"
      :max-length="maxLength"
      :require-captcha="config?.requireCaptcha !== false"
      :messages="messages"
    />

    <!-- 留言列表 -->
    <MessageList
      :messages="messages.messages.value"
      :loading="messages.loading.value"
      :current-user="auth.user.value"
    />

    <!-- 分页 -->
    <Pagination
      v-if="messages.totalPages.value > 1"
      :current="messages.page.value"
      :total="messages.totalPages.value"
      @change="onPageChange"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useMessages } from '../composables/useMessages';
import { useTheme } from '../composables/useTheme';
import LoginForm from './LoginForm.vue';
import MessageForm from './MessageForm.vue';
import MessageList from './MessageList.vue';
import Pagination from './Pagination.vue';
// CSS 通过下方 <style> 块注入 Shadow DOM

const props = defineProps<{
  pageId: string;
  apiBase: string;
  siteKey?: string; // 可选，优先使用 config API 返回的 turnstileSiteKey
  theme?: 'light' | 'dark' | 'auto';
  maxLength?: number;
}>();

// 自动补全 apiBase：若不以 /api/v1 结尾则追加
const resolvedApiBase = computed(() => {
  const base = props.apiBase.replace(/\/+$/, '');
  return base.endsWith('/api/v1') ? base : base + '/api/v1';
});

// 优先使用 config API 返回的 turnstileSiteKey，否则用 prop
const resolvedSiteKey = computed(() => config.value?.turnstileSiteKey || props.siteKey || '');

// 优先使用 config 返回的 maxMessageLength
const maxLength = computed(() => config.value?.maxMessageLength || props.maxLength || 500);

const { effectiveTheme } = useTheme(props.theme || 'auto');

// 监听主题变化
watch(effectiveTheme, (t) => {
  const el = (globalThis as any).__widget_host_el as HTMLElement;
  if (el) el.setAttribute('theme', t);
}, { immediate: true });

const auth = useAuth(resolvedApiBase.value);
const messages = useMessages(resolvedApiBase.value);

onMounted(async () => {
  // 获取配置
  await messages.fetchConfig();
  // 加载留言
  await messages.fetchMessages(props.pageId);
  // 恢复登录状态
  await auth.init();
});

function onPageChange(page: number) {
  messages.fetchMessages(props.pageId, page);
}
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
.gb-title { font-size: 20px; font-weight: 600; margin: 0 0 20px; color: var(--gb-text); }

/* 表单 */
.gb-form { margin-bottom: 20px; }
.gb-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius);
  font-size: var(--gb-font-size);
  font-family: inherit;
  resize: vertical;
  background: var(--gb-bg);
  color: var(--gb-text);
  box-sizing: border-box;
}
.gb-textarea:focus { outline: none; border-color: var(--gb-primary); }

.gb-actions { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }

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
}
.gb-btn-primary { background: var(--gb-primary); color: #fff; }
.gb-btn-primary:hover { background: var(--gb-primary-hover); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-text { background: transparent; color: var(--gb-primary); padding: 8px 8px; }
.gb-btn-text:hover { text-decoration: underline; }
.gb-btn-danger { background: var(--gb-danger); color: #fff; }

.gb-secret-toggle {
  display: flex; align-items: center; gap: 4px; cursor: pointer;
  font-size: 13px; color: var(--gb-text-secondary); user-select: none;
}
.gb-secret-toggle input { cursor: pointer; }

.gb-hint { font-size: 12px; color: var(--gb-text-secondary); margin-top: 6px; }

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

/* 认证表单 */
.gb-auth { margin-bottom: 20px; padding: 16px; background: var(--gb-bg-secondary); border-radius: var(--gb-border-radius); }
.gb-auth-title { font-size: 16px; font-weight: 500; margin: 0 0 12px; }
.gb-auth-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid var(--gb-border); }
.gb-auth-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: var(--gb-text-secondary);
  border-bottom: 2px solid transparent;
  font-family: inherit;
}
.gb-auth-tab.active { color: var(--gb-primary); border-bottom-color: var(--gb-primary); }

.gb-input-group { margin-bottom: 12px; }
.gb-label { display: block; font-size: 13px; margin-bottom: 4px; color: var(--gb-text-secondary); }
.gb-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius);
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--gb-bg);
  color: var(--gb-text);
}
.gb-input:focus { outline: none; border-color: var(--gb-primary); }

.gb-error { color: var(--gb-danger); font-size: 13px; margin-top: 4px; }

.gb-user-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding: 10px 14px; background: var(--gb-bg-secondary); border-radius: var(--gb-border-radius); }
.gb-user-info { display: flex; align-items: center; gap: 8px; }
.gb-user-name { font-weight: 500; }

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
}
.gb-page-btn:hover { border-color: var(--gb-primary); color: var(--gb-primary); }
.gb-page-btn.active { background: var(--gb-primary); color: #fff; border-color: var(--gb-primary); }
.gb-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* 空状态 */
.gb-empty { text-align: center; padding: 40px 20px; color: var(--gb-text-secondary); }

/* Turnstile */
.gb-turnstile { margin: 10px 0; }

/* Loading */
.gb-loading { text-align: center; padding: 20px; color: var(--gb-text-secondary); }

/* 状态标签 */
.gb-status-pending { color: var(--gb-warning); font-size: 12px; }
.gb-status-approved { color: var(--gb-success); font-size: 12px; }
</style>
