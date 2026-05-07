<!-- src/widget/components/LoginForm.vue — 登录/注册表单 -->
<template>
  <div class="gb-auth">
    <!-- 标签切换 -->
    <div class="gb-auth-tabs">
      <button
        class="gb-auth-tab"
        :class="{ active: mode === 'login' }"
        @click="mode = 'login'"
      >登录</button>
      <button
        v-if="allowRegistration"
        class="gb-auth-tab"
        :class="{ active: mode === 'register' }"
        @click="mode = 'register'"
      >注册</button>
    </div>

    <!-- 登录表单 -->
    <form v-if="mode === 'login'" @submit.prevent="handleLogin">
      <div class="gb-input-group">
        <label class="gb-label">用户名或邮箱</label>
        <input v-model="loginForm.login" class="gb-input" type="text" required autocomplete="username" />
      </div>
      <div class="gb-input-group">
        <label class="gb-label">密码</label>
        <input v-model="loginForm.password" class="gb-input" type="password" required autocomplete="current-password" />
      </div>
      <div class="gb-turnstile">
        <div ref="loginTurnstileRef" :id="'turnstile-login-' + instanceId"></div>
      </div>
      <div v-if="error" class="gb-error">{{ error }}</div>
      <button class="gb-btn gb-btn-primary" type="submit" :disabled="auth.loading.value">
        {{ auth.loading.value ? '登录中...' : '登录' }}
      </button>
    </form>

    <!-- 注册表单 -->
    <form v-if="mode === 'register'" @submit.prevent="handleRegister">
      <div class="gb-input-group">
        <label class="gb-label">用户名</label>
        <input v-model="registerForm.username" class="gb-input" type="text" required autocomplete="username" />
      </div>
      <div class="gb-input-group">
        <label class="gb-label">邮箱</label>
        <input v-model="registerForm.email" class="gb-input" type="email" required autocomplete="email" />
      </div>
      <div class="gb-input-group">
        <label class="gb-label">密码</label>
        <input v-model="registerForm.password" class="gb-input" type="password" required minlength="6" autocomplete="new-password" />
      </div>
      <div class="gb-turnstile">
        <div ref="registerTurnstileRef" :id="'turnstile-register-' + instanceId"></div>
      </div>
      <div v-if="error" class="gb-error">{{ error }}</div>
      <button class="gb-btn gb-btn-primary" type="submit" :disabled="auth.loading.value">
        {{ auth.loading.value ? '注册中...' : '注册' }}
      </button>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps<{
  apiBase: string;
  siteKey: string;
  auth: ReturnType<typeof import('../composables/useAuth').useAuth>;
  allowRegistration: boolean;
}>();

const mode = ref<'login' | 'register'>('login');
const error = ref('');
const loginTurnstileRef = ref<HTMLElement>();
const registerTurnstileRef = ref<HTMLElement>();
const instanceId = Math.random().toString(36).slice(2, 8);

const loginForm = ref({ login: '', password: '' });
const registerForm = ref({ username: '', email: '', password: '' });

let loginWidgetId: string | undefined;
let registerWidgetId: string | undefined;

function renderTurnstile(containerId: string, element: HTMLElement | undefined): Promise<string> {
  return new Promise((resolve) => {
    if (!element || !(window as any).turnstile) {
      resolve('');
      return;
    }
    (window as any).turnstile.render(`#${containerId}`, {
      sitekey: props.siteKey,
      callback: (token: string) => resolve(token),
      'error-callback': () => resolve(''),
    });
  });
}

function resetTurnstile(widgetId: string | undefined) {
  if (widgetId && (window as any).turnstile) {
    (window as any).turnstile.reset(widgetId);
  }
}

async function handleLogin() {
  error.value = '';
  const turnstileToken = await renderTurnstile(`turnstile-login-${instanceId}`, loginTurnstileRef.value);
  if (!turnstileToken) {
    error.value = '请完成人机验证';
    return;
  }

  const result = await props.auth.login(loginForm.value.login, loginForm.value.password, turnstileToken);
  if (!result.success) {
    error.value = result.error?.message || '登录失败';
    resetTurnstile(loginWidgetId);
  }
}

async function handleRegister() {
  error.value = '';
  const turnstileToken = await renderTurnstile(`turnstile-register-${instanceId}`, registerTurnstileRef.value);
  if (!turnstileToken) {
    error.value = '请完成人机验证';
    return;
  }

  const result = await props.auth.register(
    registerForm.value.username,
    registerForm.value.email,
    registerForm.value.password,
    turnstileToken
  );
  if (!result.success) {
    error.value = result.error?.message || '注册失败';
    resetTurnstile(registerWidgetId);
  }
}

onMounted(() => {
  // 加载 Turnstile 脚本
  if (!(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]'))) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?async=true';
    document.head.appendChild(script);
  }
});
</script>
