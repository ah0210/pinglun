<!-- src/admin/views/Login.vue — 管理员登录页 -->
<template>
  <div style="display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f0f2f5;">
    <n-card title="自游人留言板 — 管理后台" style="width: 400px;">
      <n-form ref="formRef" :model="form" :rules="rules" @submit.prevent="handleLogin">
        <n-form-item label="用户名或邮箱" path="login">
          <n-input v-model:value="form.login" placeholder="请输入用户名或邮箱" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" show-password-on="click" placeholder="请输入密码" />
        </n-form-item>
        <div :id="turnstileId" style="margin-bottom: 12px;"></div>
        <n-button type="primary" block :loading="loading" @click="handleLogin">登录</n-button>
        <n-alert v-if="error" type="error" style="margin-top: 12px;">{{ error }}</n-alert>
      </n-form>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { NCard, NForm, NFormItem, NInput, NButton, NAlert } from 'naive-ui';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();
const loading = ref(false);
const error = ref('');
const turnstileId = 'admin-turnstile-' + Math.random().toString(36).slice(2, 8);
const turnstileSiteKey = ref('');

const form = ref({ login: '', password: '' });
const rules = {
  login: { required: true, message: '请输入用户名或邮箱' },
  password: { required: true, message: '请输入密码' },
};

async function fetchConfig() {
  try {
    const resp = await fetch('/api/v1/config');
    const data = await resp.json();
    if (data.success && data.data?.turnstileSiteKey) {
      turnstileSiteKey.value = data.data.turnstileSiteKey;
    }
  } catch {
    // 忽略，Turnstile 降级
  }
}

async function handleLogin() {
  if (!form.value.login || !form.value.password) return;

  loading.value = true;
  error.value = '';

  try {
    // 获取 Turnstile token
    let turnstileToken = '';
    if ((window as any).turnstile && turnstileSiteKey.value) {
      turnstileToken = await new Promise<string>((resolve) => {
        (window as any).turnstile.render(`#${turnstileId}`, {
          sitekey: turnstileSiteKey.value,
          callback: (token: string) => resolve(token),
          'error-callback': () => resolve(''),
          size: 'invisible',
        });
      });
    }

    const result = await authStore.login(form.value.login, form.value.password, turnstileToken);
    if (result.success) {
      router.push('/dashboard');
    } else {
      error.value = (result as any).error?.message || '登录失败';
    }
  } catch (e: any) {
    error.value = e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  // 加载 Turnstile 脚本
  if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.appendChild(script);
  }

  // 获取配置（含 turnstile site key）
  await fetchConfig();

  // 初始化 auth 状态
  authStore.init();
});
</script>
