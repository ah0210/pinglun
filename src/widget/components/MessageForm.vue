<!-- src/widget/components/MessageForm.vue — 留言输入框 -->
<template>
  <div class="gb-form">
    <textarea
      v-model="content"
      class="gb-textarea"
      :placeholder="placeholder"
      :maxlength="maxLength"
      rows="3"
    ></textarea>
    <div class="gb-actions">
      <button
        class="gb-btn gb-btn-primary"
        @click="handleSubmit"
        :disabled="submitting || !canSubmit"
      >
        {{ submitting ? '发送中...' : '发送留言' }}
      </button>
      <label class="gb-secret-toggle" v-if="!isAdmin">
        <input type="checkbox" v-model="isSecret" />
        <span>🔒 秘密留言</span>
      </label>
      <span class="gb-hint">{{ contentLen }}/{{ maxLength }}<template v-if="contentLen > 0 && contentLen < minLength"> (至少{{ minLength }}字)</template></span>
    </div>
    <div v-if="contentLen >= minLength && /(.)\1{5,}/.test(content)" class="gb-error">留言不能包含过多连续重复字符</div>
    <div v-if="error" class="gb-error">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { PublicUser } from '../../shared/types';

const props = defineProps<{
  apiBase: string;
  pageId: string;
  siteKey: string;
  minLength: number;
  maxLength: number;
  requireCaptcha: boolean;
  messages: ReturnType<typeof import('../composables/useMessages').useMessages>;
  currentUser?: PublicUser | null;
}>();

const content = ref('');
const isSecret = ref(false);
const submitting = ref(false);
const error = ref('');

const isAdmin = computed(() => props.currentUser?.role === 'admin');
const placeholder = computed(() => isAdmin.value ? '以管理员身份留言...' : '写下你的留言...');

const contentLen = computed(() => content.value.trim().length);
const canSubmit = computed(() => {
  if (!content.value.trim()) return false;
  if (contentLen.value < props.minLength) return false;
  if (/(.)\1{5,}/.test(content.value)) return false;
  return true;
});

async function handleSubmit() {
  if (!content.value.trim()) return;

  submitting.value = true;
  error.value = '';

  try {
    // 获取 Turnstile token（如果需要）
    let turnstileToken = '';
    if (props.requireCaptcha && (window as any).turnstile) {
      turnstileToken = await new Promise<string>((resolve) => {
        const containerId = `gb-turnstile-msg-${Date.now()}`;
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
      content: content.value,
      pageId: props.pageId,
      isSecret: isSecret.value,
      turnstileToken,
    });

    if (result.success) {
      content.value = '';
      isSecret.value = false;
    } else {
      error.value = (result as any).error?.message || '发送失败';
    }
  } catch (e: any) {
    error.value = e.message || '发送失败';
  } finally {
    submitting.value = false;
  }
}
</script>

<style>
.gb-form {
  margin-bottom: 16px;
}
.gb-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  font-size: var(--gb-font-size, 14px);
  font-family: inherit;
  resize: vertical;
  box-sizing: border-box;
  background: var(--gb-bg, #fff);
  color: var(--gb-text, #333);
  line-height: 1.5;
}
.gb-textarea:focus {
  outline: none;
  border-color: var(--gb-primary, #4a6cf7);
}
.gb-textarea::placeholder {
  color: var(--gb-text-secondary, #999);
}
.gb-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.gb-secret-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--gb-text-secondary, #666);
  cursor: pointer;
  user-select: none;
}
.gb-secret-toggle input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
}
.gb-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--gb-text-secondary, #999);
}
.gb-error {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(231, 76, 60, 0.08);
  border: 1px solid rgba(231, 76, 60, 0.2);
  border-radius: var(--gb-border-radius, 8px);
  color: var(--gb-danger, #e74c3c);
  font-size: 13px;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .gb-textarea {
    min-height: 60px;
  }
  .gb-actions {
    gap: 8px;
  }
  .gb-hint {
    margin-left: 0;
    width: 100%;
  }
}
</style>
