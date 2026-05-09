<!-- src/widget/components/MessageList.vue — 留言列表 -->
<template>
  <div>
    <div v-if="loading" class="gb-loading">加载中...</div>
    <ul v-else-if="messages.length > 0" class="gb-message-list">
      <MessageItem
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :current-user="currentUser"
        @reply="$emit('reply', $event)"
      />
    </ul>
    <div v-else class="gb-empty">
      <p>还没有留言，来写第一条吧！</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { PublicMessage, PublicUser } from '../../shared/types';
import MessageItem from './MessageItem.vue';

defineProps<{
  messages: PublicMessage[];
  loading: boolean;
  currentUser?: PublicUser | null;
}>();

defineEmits<{
  reply: [message: PublicMessage];
}>();
</script>
