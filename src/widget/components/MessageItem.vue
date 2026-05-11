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
    if (props.requireCaptcha && (window as any).turnstile && props.siteKey) {
      turnstileToken = await new Promise<string>((resolve) => {
        const containerId = `gb-turnstile-reply-${Date.now()}`;
        const el = document.createElement('div');
        el.id = containerId;
        el.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:9999;';
        document.body.appendChild(el);

        let widgetId: string | null = null;
        const cleanup = () => {
          if (widgetId) {
            try { (window as any).turnstile.remove(widgetId); } catch {}
          }
          el.remove();
        };

        const timeout = setTimeout(() => {
          cleanup();
          resolve('');
        }, 15000);

        try {
          widgetId = (window as any).turnstile.render(`#${containerId}`, {
            sitekey: props.siteKey,
            callback: (token: string) => {
              clearTimeout(timeout);
              cleanup();
              resolve(token);
            },
            'error-callback': () => {
              clearTimeout(timeout);
              cleanup();
              resolve('');
            },
            'expired-callback': () => {
              clearTimeout(timeout);
              cleanup();
              resolve('');
            },
            size: 'compact',
            execution: 'execute',
          });
          (window as any).turnstile.execute(widgetId);
        } catch {
          clearTimeout(timeout);
          cleanup();
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

<style scoped>
.gb-message-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--gb-border, #e0e0e0);
}
.gb-message-item:last-child { border-bottom: none; }

.gb-message-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.gb-avatar {
  width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
  background: var(--gb-bg-secondary, #f7f8fa);
}
.gb-message-meta { flex: 1; min-width: 0; }
.gb-username { font-weight: 500; color: var(--gb-text, #333); }
.gb-time { font-size: 12px; color: var(--gb-text-secondary, #999); margin-left: 8px; }
.gb-secret-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 10px;
  background: var(--gb-warning, #f39c12); color: #fff; margin-left: 6px;
}
.gb-admin-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 10px;
  background: var(--gb-primary, #4a6cf7); color: #fff; margin-left: 6px;
}
.gb-status-pending { color: var(--gb-warning, #f39c12); font-size: 12px; }

.gb-message-content {
  margin: 0; line-height: 1.6; word-break: break-word; color: var(--gb-text, #333);
}
.gb-secret-placeholder {
  color: var(--gb-text-secondary, #999); font-style: italic;
}

.gb-reply-quote {
  margin-bottom: 8px; padding: 8px 12px;
  border-left: 3px solid var(--gb-primary, #4a6cf7);
  background: var(--gb-bg-secondary, #f7f8fa);
  border-radius: 0 var(--gb-border-radius, 8px) var(--gb-border-radius, 8px) 0;
  font-size: 13px; line-height: 1.5;
}
.gb-reply-quote-user { color: var(--gb-primary, #4a6cf7); font-weight: 500; margin-right: 4px; }
.gb-reply-quote-content { color: var(--gb-text-secondary, #666); }

.gb-message-actions { margin-top: 6px; }
.gb-btn-reply {
  background: none; border: none; color: var(--gb-text-secondary, #999);
  font-size: 12px; cursor: pointer; padding: 4px 8px; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  min-height: 44px; display: inline-flex; align-items: center;
}
.gb-btn-reply:active { color: var(--gb-primary, #4a6cf7); }

.gb-inline-reply {
  margin-top: 10px; padding: 12px;
  background: var(--gb-bg-secondary, #f7f8fa);
  border-radius: var(--gb-border-radius, 8px);
}
.gb-reply-target {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0 8px; font-size: 13px; color: var(--gb-primary, #4a6cf7);
}
.gb-reply-textarea { min-height: 60px; }
.gb-inline-reply-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }

.gb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border: none; border-radius: var(--gb-border-radius, 8px);
  font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation; min-height: 44px;
}
.gb-btn-primary { background: var(--gb-primary, #4a6cf7); color: #fff; }
.gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-sm { padding: 5px 12px; font-size: 13px; }

.gb-textarea {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  font-size: 16px; font-family: inherit; resize: vertical;
  box-sizing: border-box; background: var(--gb-bg, #fff);
  color: var(--gb-text, #333); line-height: 1.5;
  -webkit-appearance: none; -webkit-tap-highlight-color: transparent;
}

.gb-hint { font-size: 12px; color: var(--gb-text-secondary, #999); }
.gb-error {
  margin-top: 8px; padding: 8px 12px;
  background: rgba(231, 76, 60, 0.08); border: 1px solid rgba(231, 76, 60, 0.2);
  border-radius: var(--gb-border-radius, 8px); color: var(--gb-danger, #e74c3c); font-size: 13px;
}

@media (max-width: 480px) {
  .gb-message-header { gap: 8px; }
  .gb-username {
    display: inline-block; max-width: 120px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;
  }
  .gb-time { display: block; margin-left: 0; margin-top: 2px; }
  .gb-inline-reply-actions { flex-wrap: wrap; }
}

/* 桌面端 hover 效果（移动端不应用，避免双击问题） */
@media (hover: hover) {
  .gb-btn-reply:hover { color: var(--gb-primary, #4a6cf7); }
  .gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
}
</style>
