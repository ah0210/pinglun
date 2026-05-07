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
        :disabled="submitting || !content.trim()"
      >
        {{ submitting ? '发送中...' : '发送留言' }}
      </button>
      <label class="gb-secret-toggle" v-if="!isAdmin">
        <input type="checkbox" v-model="isSecret" />
        <span>🔒 秘密留言</span>
      </label>
      <span class="gb-hint">{{ content.length }}/{{ maxLength }}</span>
    </div>
    <div v-if="error" class="gb-error" style="margin-top:8px">{{ error }}</div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue';
import type { PublicUser } from '../../shared/types';

const props = defineProps<{
  apiBase: string;
  pageId: string;
  siteKey: string;
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

async function handleSubmit() {
  if (!content.value.trim()) return;

  submitting.value = true;
  error.value = '';

  try {
    // 获取 Turnstile token（如果需要）
    let turnstileToken = '';
    if (props.requireCaptcha && (window as any).turnstile) {
      turnstileToken = await new Promise<string>((resolve) => {
        const containerId = 'gb-turnstile-msg';
        let el = document.getElementById(containerId);
        if (!el) {
          el = document.createElement('div');
          el.id = containerId;
          el.style.display = 'none';
          document.body.appendChild(el);
        }
        (window as any).turnstile.render(`#${containerId}`, {
          sitekey: props.siteKey,
          callback: (token: string) => resolve(token),
          'error-callback': () => resolve(''),
          size: 'invisible',
        });
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
