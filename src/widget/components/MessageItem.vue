<!-- src/widget/components/MessageItem.vue — 单条留言 -->
<template>
  <li class="gb-message-item">
    <div class="gb-message-header">
      <img :src="message.user.avatar" class="gb-avatar" :alt="message.user.displayName" />
      <div class="gb-message-meta">
        <span class="gb-username">{{ message.user.displayName }}</span>
        <span v-if="message.user.role === 'admin'" class="gb-admin-badge">管理员</span>
        <span v-if="message.isSecret" class="gb-secret-badge">🔒 秘密</span>
        <span v-if="message.status === 'pending'" class="gb-status-pending">⏳ 审核中</span>
        <span class="gb-time">{{ formatTime(message.createdAt) }}</span>
      </div>
    </div>

    <!-- 被回复留言引用块 -->
    <div v-if="message.replyToMessage" class="gb-reply-quote">
      <span class="gb-reply-quote-user">@{{ message.replyToMessage.username }}</span>
      <span class="gb-reply-quote-content">
        {{ message.replyToMessage.isSecret && isReplySecretHidden ? '🔒 这是一条秘密留言' : message.replyToMessage.content }}
      </span>
    </div>

    <p class="gb-message-content" :class="{ 'gb-secret-placeholder': isSecretHidden }">
      {{ isSecretHidden ? '🔒 这是一条秘密留言' : message.content }}
    </p>

    <!-- 回复按钮（仅登录用户可见） -->
    <div v-if="currentUser" class="gb-message-actions">
      <button class="gb-btn gb-btn-reply" @click="$emit('reply', message)">回复</button>
    </div>
  </li>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import type { PublicMessage, PublicUser } from '../../shared/types';

const props = defineProps<{
  message: PublicMessage;
  currentUser?: PublicUser | null;
}>();

defineEmits<{
  reply: [message: PublicMessage];
}>();

const isSecretHidden = computed(() => {
  if (!props.message.isSecret) return false;
  // 留言者本人和管理员可见内容，不显示占位
  if (props.currentUser?.role === 'admin') return false;
  if (props.currentUser && props.currentUser.id === props.message.user.id) return false;
  return true;
});

// 被回复留言的秘密内容也需按权限隐藏
const isReplySecretHidden = computed(() => {
  if (!props.message.replyToMessage?.isSecret) return false;
  if (props.currentUser?.role === 'admin') return false;
  // 无法直接获取被回复留言的 user_id，由后端已处理隐藏
  // 前端此处作为兜底：如果当前用户不是留言者本人则隐藏
  // 后端已根据 reply_user_id 做了判断，前端直接用后端返回的 content 即可
  return false;
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
