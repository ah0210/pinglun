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
      <span class="gb-reply-quote-user">@{{ message.replyToMessage.displayName || message.replyToMessage.username }}</span>
      <span class="gb-reply-quote-content">
        {{ message.replyToMessage.isSecret && isReplySecretHidden ? '🔒 这是一条秘密留言' : message.replyToMessage.content }}
      </span>
    </div>

    <p class="gb-message-content" :class="{ 'gb-secret-placeholder': isSecretHidden }">
      {{ isSecretHidden ? '🔒 这是一条秘密留言' : message.content }}
    </p>

    <!-- 回复按钮（仅登录用户可见） -->
    <div v-if="currentUser" class="gb-message-actions">
      <button class="gb-btn gb-btn-reply" @click="toggleReply">
        {{ isReplying ? '取消回复' : '回复' }}
      </button>
    </div>

    <!-- 内联回复表单 -->
    <div v-if="isReplying" class="gb-inline-reply">
      <div class="gb-reply-target">
        <span>回复 <strong>@{{ message.user.displayName }}</strong></span>
      </div>
      <textarea
        ref="replyTextarea"
        v-model="replyContent"
        class="gb-textarea gb-reply-textarea"
        :placeholder="`回复 @${message.user.displayName}...`"
        :maxlength="maxLength"
        rows="2"
      ></textarea>
      <div class="gb-inline-reply-actions">
        <button
          class="gb-btn gb-btn-primary gb-btn-sm"
          @click="handleReplySubmit"
          :disabled="submitting || !canReplySubmit"
        >
          {{ submitting ? '发送中...' : '发送回复' }}
        </button>
        <span class="gb-hint">{{ replyContentLen }}/{{ maxLength }}<template v-if="replyContentLen > 0 && replyContentLen < minLength"> (至少{{ minLength }}字)</template></span>
      </div>
      <div v-if="replyContentLen >= minLength && /(.)\1{5,}/.test(replyContent)" class="gb-error">留言不能包含过多连续重复字符</div>
      <div v-if="replyError" class="gb-error">{{ replyError }}</div>
    </div>
  </li>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref } from 'vue';
import type { PublicMessage, PublicUser } from '../../shared/types';

const props = defineProps<{
  message: PublicMessage;
  currentUser?: PublicUser | null;
  messages: ReturnType<typeof import('../composables/useMessages').useMessages>;
  pageId: string;
  minLength: number;
  maxLength: number;
  siteKey: string;
  requireCaptcha: boolean;
}>();

const isReplying = ref(false);
const replyContent = ref('');
const submitting = ref(false);
const replyError = ref('');
const replyTextarea = ref<HTMLTextAreaElement | null>(null);

const isSecretHidden = computed(() => {
  if (!props.message.isSecret) return false;
  if (props.currentUser?.role === 'admin') return false;
  if (props.currentUser && props.currentUser.id === props.message.user.id) return false;
  return true;
});

// 被回复留言的秘密内容 — 后端已按权限处理
const isReplySecretHidden = computed(() => false);

const replyContentLen = computed(() => replyContent.value.trim().length);
const canReplySubmit = computed(() => {
  if (!replyContent.value.trim()) return false;
  if (replyContentLen.value < props.minLength) return false;
  if (/(.)\1{5,}/.test(replyContent.value)) return false;
  return true;
});

async function toggleReply() {
  isReplying.value = !isReplying.value;
  if (isReplying.value) {
    replyContent.value = '';
    replyError.value = '';
    await nextTick();
    replyTextarea.value?.focus();
  }
}

async function handleReplySubmit() {
  if (!replyContent.value.trim()) return;

  submitting.value = true;
  replyError.value = '';

  try {
    // 获取 Turnstile token（如果需要）
    let turnstileToken = '';
    if (props.requireCaptcha && (window as any).turnstile) {
      turnstileToken = await new Promise<string>((resolve) => {
        const containerId = `gb-turnstile-reply-${Date.now()}`;
        const el = document.createElement('div');
        el.id = containerId;
        el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;';
        document.body.appendChild(el);

        const timeout = setTimeout(() => {
          try { (window as any).turnstile.remove(containerId); } catch {}
          el.remove();
          resolve('');
        }, 10000);

        try {
          const widgetId = (window as any).turnstile.render(`#${containerId}`, {
            sitekey: props.siteKey,
            callback: (token: string) => {
              clearTimeout(timeout);
              try { (window as any).turnstile.remove(containerId); } catch {}
              el.remove();
              resolve(token);
            },
            'error-callback': () => {
              clearTimeout(timeout);
              try { (window as any).turnstile.remove(containerId); } catch {}
              el.remove();
              resolve('');
            },
            'expired-callback': () => {
              clearTimeout(timeout);
              resolve('');
            },
            size: 'compact',
            execution: 'execute',
          });
          (window as any).turnstile.execute(widgetId);
        } catch {
          clearTimeout(timeout);
          el.remove();
          resolve('');
        }
      });
    }

    const result = await props.messages.postMessage({
      content: replyContent.value,
      pageId: props.pageId,
      replyTo: props.message.id,
      turnstileToken,
    });

    if (result.success) {
      isReplying.value = false;
      replyContent.value = '';
    } else {
      replyError.value = (result as any).error?.message || '发送失败';
    }
  } catch (e: any) {
    replyError.value = e.message || '发送失败';
  } finally {
    submitting.value = false;
  }
}

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
