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
      :api-base="apiBase"
      :site-key="siteKey"
      :auth="auth"
      :allow-registration="config?.allowRegistration !== false"
    />

    <!-- 留言输入 -->
    <MessageForm
      v-if="auth.user.value"
      :api-base="apiBase"
      :page-id="pageId"
      :site-key="siteKey"
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
import { onMounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useMessages } from '../composables/useMessages';
import { useTheme } from '../composables/useTheme';
import LoginForm from './LoginForm.vue';
import MessageForm from './MessageForm.vue';
import MessageList from './MessageList.vue';
import Pagination from './Pagination.vue';
import '../styles.css';

const props = defineProps<{
  pageId: string;
  apiBase: string;
  siteKey: string;
  theme?: 'light' | 'dark' | 'auto';
  maxLength?: number;
}>();

const { effectiveTheme } = useTheme(props.theme || 'auto');

// 监听主题变化
watch(effectiveTheme, (t) => {
  const el = (globalThis as any).__widget_host_el as HTMLElement;
  if (el) el.setAttribute('theme', t);
}, { immediate: true });

const auth = useAuth(props.apiBase);
const messages = useMessages(props.apiBase);

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
