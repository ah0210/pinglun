<!-- src/widget/components/MessageItem.vue — 单条留言 -->
<template>
  <li class="gb-message-item">
    <div class="gb-message-header">
      <img :src="message.user.avatar" class="gb-avatar" :alt="message.user.displayName" />
      <div class="gb-message-meta">
        <span class="gb-username">{{ message.user.displayName }}</span>
        <span v-if="message.user.role === 'admin'" class="gb-admin-badge">管理员</span>
        <span v-if="message.isSecret" class="gb-secret-badge">🔒 秘密</span>
        <span class="gb-time">{{ formatTime(message.createdAt) }}</span>
      </div>
    </div>
    <p class="gb-message-content" :class="{ 'gb-secret-placeholder': isSecretPlaceholder }">
      {{ message.content }}
    </p>
  </li>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { PublicMessage, PublicUser } from '../../shared/types';

const props = defineProps<{
  message: PublicMessage;
  currentUser?: PublicUser | null;
}>();

const isSecretPlaceholder = computed(() => {
  return props.message.isSecret &&
    props.message.content === '[这是一条秘密留言]';
});

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
</script>
