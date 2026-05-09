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
      <div v-if="error" class="gb-error">{{ error }}</div>
      <button class="gb-btn gb-btn-primary" type="submit" :disabled="auth.loading.value">
        {{ auth.loading.value ? '注册中...' : '注册' }}
      </button>
    </form>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  apiBase: string;
  siteKey: string;
  auth: ReturnType<typeof import('../composables/useAuth').useAuth>;
  allowRegistration: boolean;
}>();

const mode = ref<'login' | 'register'>('login');
const error = ref('');
const instanceId = Math.random().toString(36).slice(2, 8);

const loginForm = ref({ login: '', password: '' });
const registerForm = ref({ username: '', email: '', password: '' });

let loginWidgetId: string | undefined;
let registerWidgetId: string | undefined;

/** 在 document.body 上创建临时容器并用 invisible 模式渲染 Turnstile（兼容 Shadow DOM） */
function renderTurnstile(action: 'login' | 'register'): Promise<string> {
  return new Promise((resolve) => {
    const turnstile = (window as any).turnstile;
    if (!turnstile) {
      // Turnstile 脚本未加载，跳过验证（由后端兜底）
      resolve('');
      return;
    }

    const containerId = `gb-turnstile-${action}-${instanceId}`;
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;visibility:hidden;';
      document.body.appendChild(container);
    }

    // 10 秒超时保护，防止 Promise 永远挂起
    const timeout = setTimeout(() => {
      resolve('');
    }, 10000);

    try {
      turnstile.render(`#${containerId}`, {
        sitekey: props.siteKey,
        callback: (token: string) => {
          clearTimeout(timeout);
          resolve(token);
        },
        'error-callback': () => {
          clearTimeout(timeout);
          resolve('');
        },
        size: 'invisible',
      });
    } catch {
      clearTimeout(timeout);
      resolve('');
    }
  });
}

/** 清理 Turnstile 临时容器 */
function removeTurnstileContainer(action: 'login' | 'register') {
  const containerId = `gb-turnstile-${action}-${instanceId}`;
  const container = document.getElementById(containerId);
  if (container) {
    const turnstile = (window as any).turnstile;
    if (turnstile) {
      try { turnstile.remove(containerId); } catch {}
    }
    container.remove();
  }
}

function resetTurnstile(widgetId: string | undefined) {
  if (widgetId && (window as any).turnstile) {
    try { (window as any).turnstile.reset(widgetId); } catch {}
  }
}

async function handleLogin() {
  error.value = '';
  // Turnstile 尽量获取 token，失败时传空串由后端决定是否需要
  const turnstileToken = await renderTurnstile('login');

  const result = await props.auth.login(loginForm.value.login, loginForm.value.password, turnstileToken);
  if (!result.success) {
    error.value = result.error?.message || '登录失败';
    removeTurnstileContainer('login');
    resetTurnstile(loginWidgetId);
  } else {
    removeTurnstileContainer('login');
  }
}

async function handleRegister() {
  error.value = '';
  // Turnstile 尽量获取 token，失败时传空串由后端决定是否需要
  const turnstileToken = await renderTurnstile('register');

  const result = await props.auth.register(
    registerForm.value.username,
    registerForm.value.email,
    registerForm.value.password,
    turnstileToken
  );
  if (!result.success) {
    error.value = result.error?.message || '注册失败';
    removeTurnstileContainer('register');
    resetTurnstile(registerWidgetId);
  } else {
    removeTurnstileContainer('register');
  }
}

onMounted(() => {
  // 加载 Turnstile 脚本
  if (!(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]'))) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    document.head.appendChild(script);
  }
});

onUnmounted(() => {
  removeTurnstileContainer('login');
  removeTurnstileContainer('register');
});
</script>
