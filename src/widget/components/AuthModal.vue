<!-- src/widget/components/AuthModal.vue — 认证弹窗（6 种模式） -->
<template>
    <div v-if="visible" ref="overlayRef" class="gb-modal-overlay" @click="handleOverlayClick" @touchend="handleOverlayTouchEnd">
      <div class="gb-modal">
        <button class="gb-modal-close" @click="close">&times;</button>

        <!-- 登录 -->
        <form v-if="mode === 'login'" @submit.prevent="handleLogin">
          <h3 class="gb-modal-title">登录</h3>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-login`">用户名或邮箱</label>
            <input v-model="form.login" class="gb-input" type="text" required autocomplete="username" :id="`${instanceId}-login`" />
          </div>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-password`">密码</label>
            <input v-model="form.password" class="gb-input" type="password" required autocomplete="current-password" :id="`${instanceId}-password`" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '登录中...' : '登录' }}
          </button>
          <div class="gb-modal-links">
            <button type="button" class="gb-link-btn" @click="switchMode('forgot-password')">忘记密码？</button>
            <button type="button" class="gb-link-btn" @click="switchMode('register')">没有账号？注册</button>
          </div>
        </form>

        <!-- 注册 -->
        <form v-if="mode === 'register'" @submit.prevent="handleRegister">
          <h3 class="gb-modal-title">注册</h3>
          <div class="gb-field-row">
            <label class="gb-label" :for="`${instanceId}-username`">用户名</label>
            <input v-model="form.username" class="gb-input" type="text" required autocomplete="username" :id="`${instanceId}-username`" placeholder="2-30位，中英文/数字/下划线" />
          </div>
          <div class="gb-field-row">
            <label class="gb-label" :for="`${instanceId}-reg-email`">邮箱</label>
            <input v-model="form.email" class="gb-input" type="email" required autocomplete="email" :id="`${instanceId}-reg-email`" placeholder="example@domain.com" />
          </div>
          <div class="gb-field-row">
            <label class="gb-label" :for="`${instanceId}-reg-phone`">手机号</label>
            <input v-model="form.phone" class="gb-input" type="tel" required autocomplete="tel" :id="`${instanceId}-reg-phone`" maxlength="11" placeholder="中国大陆11位手机号" />
          </div>
          <div class="gb-field-row">
            <label class="gb-label" :for="`${instanceId}-reg-password`">密码</label>
            <input v-model="form.password" class="gb-input" type="password" required minlength="8" autocomplete="new-password" :id="`${instanceId}-reg-password`" placeholder="8-20位，含字母和数字" />
          </div>
          <div class="gb-field-row">
            <label class="gb-label" :for="`${instanceId}-confirm-password`">确认密码</label>
            <input v-model="form.confirmPassword" class="gb-input" type="password" required autocomplete="new-password" :id="`${instanceId}-confirm-password`" placeholder="再次输入密码" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '注册中...' : '注册' }}
          </button>
          <div class="gb-modal-links">
            <button type="button" class="gb-link-btn" @click="switchMode('login')">已有账号？登录</button>
          </div>
        </form>

        <!-- 忘记密码 -->
        <form v-if="mode === 'forgot-password'" @submit.prevent="handleForgotPassword">
          <h3 class="gb-modal-title">找回密码</h3>
          <p class="gb-modal-desc">输入注册邮箱，我们将发送重置链接到您的邮箱。</p>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-forgot-email`">邮箱</label>
            <input v-model="form.email" class="gb-input" type="email" required autocomplete="email" :id="`${instanceId}-forgot-email`" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <div v-if="successMsg" class="gb-success">{{ successMsg }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '发送中...' : '发送重置邮件' }}
          </button>
          <div class="gb-modal-links">
            <button type="button" class="gb-link-btn" @click="switchMode('login')">返回登录</button>
          </div>
        </form>

        <!-- 重置密码 -->
        <form v-if="mode === 'reset-password'" @submit.prevent="handleResetPassword">
          <h3 class="gb-modal-title">重置密码</h3>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-new-password`">新密码</label>
            <input v-model="form.newPassword" class="gb-input" type="password" required minlength="8" autocomplete="new-password" :id="`${instanceId}-new-password`" />
            <div class="gb-hint">至少 8 个字符，需包含字母和数字</div>
          </div>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-reset-confirm`">确认新密码</label>
            <input v-model="form.confirmPassword" class="gb-input" type="password" required autocomplete="new-password" :id="`${instanceId}-reset-confirm`" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <div v-if="successMsg" class="gb-success">{{ successMsg }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '重置中...' : '重置密码' }}
          </button>
        </form>

        <!-- 修改显示名称 -->
        <form v-if="mode === 'change-display-name'" @submit.prevent="handleChangeDisplayName">
          <h3 class="gb-modal-title">修改显示名称</h3>
          <p class="gb-modal-desc">显示名称将替代用户名在留言中展示。</p>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-display-name`">显示名称</label>
            <input v-model="form.displayName" class="gb-input" type="text" required maxlength="30" :id="`${instanceId}-display-name`" />
            <div class="gb-hint">2-30 个字符，支持中英文、数字、下划线和连字符</div>
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <div v-if="successMsg" class="gb-success">{{ successMsg }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '修改中...' : '修改显示名称' }}
          </button>
        </form>

        <!-- 修改密码 -->
        <form v-if="mode === 'change-password'" @submit.prevent="handleChangePassword">
          <h3 class="gb-modal-title">修改密码</h3>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-current-password`">当前密码</label>
            <input v-model="form.currentPassword" class="gb-input" type="password" required autocomplete="current-password" :id="`${instanceId}-current-password`" />
          </div>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-ch-new-password`">新密码</label>
            <input v-model="form.newPassword" class="gb-input" type="password" required minlength="8" autocomplete="new-password" :id="`${instanceId}-ch-new-password`" />
            <div class="gb-hint">至少 8 个字符，需包含字母和数字</div>
          </div>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-ch-confirm`">确认新密码</label>
            <input v-model="form.confirmPassword" class="gb-input" type="password" required autocomplete="new-password" :id="`${instanceId}-ch-confirm`" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <div v-if="successMsg" class="gb-success">{{ successMsg }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '修改中...' : '修改密码' }}
          </button>
        </form>

        <!-- 修改邮箱 -->
        <form v-if="mode === 'change-email'" @submit.prevent="handleChangeEmail">
          <h3 class="gb-modal-title">修改邮箱</h3>
          <p class="gb-modal-desc">修改后需重新验证新邮箱才能留言。</p>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-new-email`">新邮箱</label>
            <input v-model="form.newEmail" class="gb-input" type="email" required autocomplete="email" :id="`${instanceId}-new-email`" />
          </div>
          <div class="gb-field">
            <label class="gb-label" :for="`${instanceId}-ce-current-password`">当前密码</label>
            <input v-model="form.currentPassword" class="gb-input" type="password" required autocomplete="current-password" :id="`${instanceId}-ce-current-password`" />
          </div>
          <div v-if="error" class="gb-error">{{ error }}</div>
          <div v-if="successMsg" class="gb-success">{{ successMsg }}</div>
          <button class="gb-btn gb-btn-primary gb-btn-block" type="submit" :disabled="auth.loading.value">
            {{ auth.loading.value ? '修改中...' : '修改邮箱' }}
          </button>
        </form>
      </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { themeSheet } from '../styles/theme';
import { ensureTurnstileSDK, renderTurnstileWidget, removeTurnstileWidget } from '../utils/turnstile';

export type AuthModalMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'change-display-name' | 'change-password' | 'change-email';

const props = defineProps<{
  siteKey: string;
  theme?: 'light' | 'dark' | 'auto';
  forceSkipTurnstile?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const auth = useAuth();

const visible = ref(false);
const mode = ref<AuthModalMode>('login');
const error = ref('');
const successMsg = ref('');
const resetToken = ref('');

const form = ref({
  login: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
  newEmail: '',
  displayName: '',
});

const instanceId = Math.random().toString(36).slice(2, 8);

// ===== DOM Portal =====
// 将弹窗渲染到 document.body 上的独立 Shadow Root，
// 避免 <gb-auth-bar> 放在导航栏时祖先元素的 containing block 影响 position:fixed
const overlayRef = ref<HTMLElement | null>(null);
let portalHost: HTMLElement | null = null;
let portalShadow: ShadowRoot | null = null;

// 弹窗专用样式（与 themeSheet 的 :host 变量配合使用）
const modalCSS = `
.gb-modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  font-family: var(--gb-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  font-size: var(--gb-font-size, 14px);
  color: var(--gb-text, #333);
}
.gb-modal {
  background: var(--gb-bg, #fff);
  border-radius: var(--gb-border-radius, 8px);
  padding: 28px 24px;
  width: 100%;
  max-width: 400px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
  color: var(--gb-text, #333);
}
.gb-modal-close {
  position: absolute; top: 8px; right: 8px;
  background: none; border: none; font-size: 24px;
  cursor: pointer; color: var(--gb-text-secondary, #999);
  padding: 8px; line-height: 1; min-width: 44px; min-height: 44px;
  display: flex; align-items: center; justify-content: center;
  border-radius: var(--gb-border-radius, 8px);
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
}
.gb-modal-close:hover { color: var(--gb-text, #333); }
.gb-modal-close:active { background: var(--gb-bg-secondary, #f7f8fa); }
.gb-modal-title { font-size: 18px; font-weight: 600; margin: 0 0 20px; color: var(--gb-text, #333); }
.gb-modal-desc { font-size: 13px; color: var(--gb-text-secondary, #666); margin: 0 0 16px; line-height: 1.5; }
.gb-field { margin-bottom: 14px; }
.gb-field-row { display: flex; align-items: center; margin-bottom: 14px; gap: 10px; }
.gb-field-row .gb-label { flex-shrink: 0; width: 70px; text-align: right; margin-bottom: 0; }
.gb-field-row .gb-input { flex: 1; min-width: 0; }
.gb-label { display: block; font-size: 13px; margin-bottom: 4px; color: var(--gb-text-secondary, #666); }
.gb-input {
  width: 100%; padding: 8px 12px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  font-size: 16px; font-family: inherit; box-sizing: border-box;
  background: var(--gb-bg, #fff); color: var(--gb-text, #333);
  -webkit-appearance: none; -webkit-tap-highlight-color: transparent;
}
.gb-input:focus { outline: none; border-color: var(--gb-primary, #4a6cf7); }
.gb-hint { font-size: 12px; color: var(--gb-text-secondary, #999); margin-top: 4px; }
.gb-error { color: var(--gb-danger, #e74c3c); font-size: 13px; margin-bottom: 12px; }
.gb-success { color: var(--gb-success, #27ae60); font-size: 13px; margin-bottom: 12px; }
.gb-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 8px 16px; border: none; border-radius: var(--gb-border-radius, 8px);
  font-size: 14px; cursor: pointer; transition: all 0.2s; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation; min-height: 44px;
}
.gb-btn-primary { background: var(--gb-primary, #4a6cf7); color: #fff; }
.gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-block { display: flex; width: 100%; }
.gb-modal-links { display: flex; justify-content: space-between; margin-top: 14px; }
.gb-link-btn {
  background: none; border: none; color: var(--gb-primary, #4a6cf7);
  font-size: 13px; cursor: pointer; padding: 4px 0; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  min-height: 44px; display: inline-flex; align-items: center;
}
.gb-link-btn:active { opacity: 0.7; }
/* 移动端适配 */
@media (max-width: 480px) {
  .gb-modal-overlay { padding: 0; align-items: flex-end; }
  .gb-modal { padding: 20px 16px; max-height: 95vh; border-radius: var(--gb-border-radius, 8px) var(--gb-border-radius, 8px) 0 0; }
  .gb-modal-title { font-size: 16px; padding-right: 36px; }
  .gb-modal-links { flex-direction: column; gap: 8px; align-items: center; }
  .gb-field-row { flex-direction: column; align-items: stretch; }
  .gb-field-row .gb-label { width: auto; text-align: left; }
}
/* 桌面端 hover 效果 */
@media (hover: hover) {
  .gb-modal-close:hover { color: var(--gb-text, #333); }
  .gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
  .gb-link-btn:hover { text-decoration: underline; }
}
`;

const modalSheet = new CSSStyleSheet();
modalSheet.replaceSync(modalCSS);

function createPortal() {
  const overlay = overlayRef.value;
  if (!overlay || portalHost) return;

  // 在 document.body 上创建宿主元素
  portalHost = document.createElement('div');
  portalHost.setAttribute('theme', props.theme || 'auto');
  document.body.appendChild(portalHost);

  // 创建 Shadow Root 提供样式封装
  portalShadow = portalHost.attachShadow({ mode: 'open' });

  // 注入主题变量 + 弹窗样式
  // :host 在此 Shadow Root 中匹配 portalHost，:host([theme="dark"]) 匹配暗色主题
  portalShadow.adoptedStyleSheets = [themeSheet, modalSheet];

  // 将 overlay 从组件 Shadow DOM 移动到 body 级 Shadow Root
  const mountPoint = document.createElement('div');
  portalShadow.appendChild(mountPoint);
  mountPoint.appendChild(overlay);
}

function destroyPortal() {
  if (portalHost) {
    portalHost.remove();
    portalHost = null;
    portalShadow = null;
  }
}

// 监听主题变化，同步到 portal 宿主元素
watch(() => props.theme, (t) => {
  if (portalHost) {
    portalHost.setAttribute('theme', t || 'auto');
  }
});

// ===== 弹窗控制 =====
function open(newMode: AuthModalMode, token?: string) {
  mode.value = newMode;
  error.value = '';
  successMsg.value = '';
  resetForm();
  if (token) resetToken.value = token;
  // 预填充当前显示名称
  if (newMode === 'change-display-name' && auth.user.value) {
    form.value.displayName = auth.user.value.displayName || '';
  }
  visible.value = true;
  // 等 Vue 渲染 overlay 后，将其移至 body 级 portal
  nextTick(() => {
    createPortal();
  });
}

function close() {
  visible.value = false;
  error.value = '';
  successMsg.value = '';
  removeTurnstileContainer();
  emit('close');
  // Vue 卸载 overlay 后清理 portal
  nextTick(() => {
    destroyPortal();
  });
}

function switchMode(newMode: AuthModalMode) {
  mode.value = newMode;
  error.value = '';
  successMsg.value = '';
}

function resetForm() {
  form.value = {
    login: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
    newEmail: '',
    displayName: '',
  };
}

function handleOverlayClick(e: MouseEvent) {
  // 只有点击遮罩层本身时才关闭（不是点击弹窗内容）
  if (e.target === e.currentTarget) {
    close();
  }
}

function handleOverlayTouchEnd(e: TouchEvent) {
  // 移动端触摸关闭遮罩层
  if (e.target === e.currentTarget) {
    e.preventDefault(); // 阻止后续 click 事件避免重复触发
    close();
  }
}

// ===== Turnstile =====
let turnstileWidgetId: string | null = null;

/**
 * 渲染 Turnstile 并等待验证 token（render 模式，无竞态）
 * 先确保 SDK 加载，再 render，callback 直接返回 token
 * @param action - 验证场景标识（login/register/forgot-password）
 * @returns Promise<string> - 验证完成后返回 token，失败/超时返回空串
 */
async function renderTurnstile(action: string): Promise<string> {
  if (props.forceSkipTurnstile) return '';
  if (!props.siteKey) {
    console.warn('[Guestbook] Turnstile siteKey not configured, skipping captcha');
    return '';
  }

  /** 确保 SDK 已加载 */
  const sdkReady = await ensureTurnstileSDK();
  if (!sdkReady) {
    console.warn('[Guestbook] Turnstile SDK failed to load, skipping captcha');
    return '';
  }

  /** 先清理旧的 widget */
  removeTurnstileContainer();

  const containerId = `gb-turnstile-modal-${instanceId}`;
  const container = document.createElement('div');
  container.id = containerId;
  container.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;';
  document.body.appendChild(container);

  /**
   * render 模式：render() 时 SDK 自动触发验证，callback 返回 token
   * 不调 execute()，无竞态
   */
  return new Promise<string>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[Guestbook] Turnstile verification timed out');
      removeTurnstileContainer();
      resolve('');
    }, 30000);

    try {
      const turnstile = (window as any).turnstile;
      turnstileWidgetId = turnstile.render(`#${containerId}`, {
        sitekey: props.siteKey,
        execution: 'render',
        callback: (token: string) => {
          clearTimeout(timeout);
          resolve(token || '');
        },
        'error-callback': (error: string) => {
          clearTimeout(timeout);
          console.warn('[Guestbook] Turnstile error:', error);
          resolve('');
        },
        'expired-callback': () => {
          clearTimeout(timeout);
          console.warn('[Guestbook] Turnstile token expired');
          resolve('');
        },
        size: 'compact',
        action,
      });
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[Guestbook] Turnstile render failed:', e);
      resolve('');
    }
  });
}

function removeTurnstileContainer() {
  removeTurnstileWidget(turnstileWidgetId);
  turnstileWidgetId = null;
  const containerId = `gb-turnstile-modal-${instanceId}`;
  const container = document.getElementById(containerId);
  if (container) {
    container.remove();
  }
}

// ===== 防重复提交锁 =====
let submitting = false;

// ===== 表单处理 =====
async function handleLogin() {
  if (submitting || auth.loading.value) return;
  submitting = true;
  error.value = '';
  try {
    const turnstileToken = await renderTurnstile('login');
    const result = await auth.login(form.value.login, form.value.password, turnstileToken);
    if (!result.success) {
      error.value = result.error?.message || '登录失败';
      removeTurnstileContainer();
    } else {
      close();
    }
  } finally {
    submitting = false;
  }
}

async function handleRegister() {
  if (submitting || auth.loading.value) return;
  error.value = '';

  // 验证用户名
  const username = form.value.username.trim();
  if (username.length < 2 || username.length > 30) {
    error.value = '用户名长度需在 2-30 之间';
    return;
  }

  // 严格验证邮箱
  const email = form.value.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    error.value = '邮箱格式不正确';
    return;
  }

  // 严格验证手机号（中国大陆格式：1开头，第二位3-9，共11位）
  const phone = form.value.phone.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    error.value = '手机号格式不正确（需为中国大陆11位手机号）';
    return;
  }

  // 验证密码
  if (form.value.password !== form.value.confirmPassword) {
    error.value = '两次输入的密码不一致';
    return;
  }
  if (form.value.password.length < 8) {
    error.value = '密码至少 8 个字符';
    return;
  }
  if (!/[a-zA-Z]/.test(form.value.password) || !/[0-9]/.test(form.value.password)) {
    error.value = '密码需包含字母和数字';
    return;
  }

  submitting = true;
  try {
    const turnstileToken = await renderTurnstile('register');
    const result = await auth.register(form.value.username, form.value.email, form.value.phone, form.value.password, turnstileToken);
    if (!result.success) {
      error.value = result.error?.message || '注册失败';
      removeTurnstileContainer();
    } else {
      close();
    }
  } finally {
    submitting = false;
  }
}

async function handleForgotPassword() {
  if (submitting || auth.loading.value) return;
  submitting = true;
  error.value = '';
  successMsg.value = '';
  try {
    const turnstileToken = await renderTurnstile('forgot-password');
    const result = await auth.forgotPassword(form.value.email, turnstileToken);
    if (result.success) {
      successMsg.value = result.data?.message || '如果该邮箱已注册，您将收到重置邮件';
      removeTurnstileContainer();
    } else {
      error.value = result.error?.message || '操作失败';
      removeTurnstileContainer();
    }
  } finally {
    submitting = false;
  }
}

async function handleResetPassword() {
  if (submitting || auth.loading.value) return;
  error.value = '';
  successMsg.value = '';
  if (form.value.newPassword !== form.value.confirmPassword) {
    error.value = '两次输入的密码不一致';
    return;
  }
  if (form.value.newPassword.length < 8) {
    error.value = '密码至少 8 个字符';
    return;
  }
  submitting = true;
  try {
    const result = await auth.resetPassword(resetToken.value, form.value.newPassword);
    if (result.success) {
      successMsg.value = '密码重置成功，请使用新密码登录';
      setTimeout(() => { close(); open('login'); }, 2000);
    } else {
      error.value = result.error?.message || '重置失败';
    }
  } finally {
    submitting = false;
  }
}

async function handleChangePassword() {
  if (submitting || auth.loading.value) return;
  error.value = '';
  successMsg.value = '';
  if (form.value.newPassword !== form.value.confirmPassword) {
    error.value = '两次输入的密码不一致';
    return;
  }
  if (form.value.newPassword.length < 8) {
    error.value = '新密码至少 8 个字符';
    return;
  }
  submitting = true;
  try {
    const result = await auth.changePassword(form.value.currentPassword, form.value.newPassword);
    if (result.success) {
      successMsg.value = '密码修改成功，请重新登录';
      setTimeout(() => { close(); open('login'); }, 2000);
    } else {
      error.value = result.error?.message || '修改失败';
    }
  } finally {
    submitting = false;
  }
}

async function handleChangeEmail() {
  if (submitting || auth.loading.value) return;
  error.value = '';
  successMsg.value = '';
  submitting = true;
  try {
    const result = await auth.changeEmail(form.value.newEmail, form.value.currentPassword);
    if (result.success) {
      successMsg.value = '邮箱已修改，请验证新邮箱';
      setTimeout(() => close(), 2000);
    } else {
      error.value = result.error?.message || '修改失败';
    }
  } finally {
    submitting = false;
  }
}

async function handleChangeDisplayName() {
  if (submitting || auth.loading.value) return;
  error.value = '';
  successMsg.value = '';
  const name = form.value.displayName.trim();
  if (!name || name.length < 2) {
    error.value = '显示名称至少 2 个字符';
    return;
  }
  if (name.length > 30) {
    error.value = '显示名称不能超过 30 个字符';
    return;
  }
  submitting = true;
  try {
    const result = await auth.updateProfile({ displayName: name });
    if (result.success) {
      successMsg.value = '显示名称修改成功';
      setTimeout(() => close(), 1500);
    } else {
      error.value = result.error?.message || '修改失败';
    }
  } finally {
    submitting = false;
  }
}

// ===== 全局事件监听 =====
function onGbOpenAuth(e: Event) {
  const detail = (e as CustomEvent).detail;
  if (detail?.mode) {
    open(detail.mode, detail.token);
  }
}

onMounted(() => {
  document.addEventListener('gb-open-auth', onGbOpenAuth);

  // 检查 URL 中是否有 reset_token
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('reset_token');
  if (token) {
    resetToken.value = token;
    open('reset-password', token);
    // 清除 URL 中的 token 参数
    const url = new URL(window.location.href);
    url.searchParams.delete('reset_token');
    window.history.replaceState({}, '', url.toString());
  }

  // 加载 Turnstile 脚本
  if (!document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.appendChild(script);
  }
});

onUnmounted(() => {
  document.removeEventListener('gb-open-auth', onGbOpenAuth);
  removeTurnstileContainer();
  destroyPortal();
});

defineExpose({ open, close });
</script>

<style scoped>
/* Shadow DOM 内的回退样式（portal 创建前的瞬间使用） */
.gb-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 16px;
  box-sizing: border-box;
}

.gb-modal {
  background: var(--gb-bg, #fff);
  border-radius: var(--gb-border-radius, 8px);
  padding: 28px 24px;
  width: 100%;
  max-width: 400px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
  color: var(--gb-text, #333);
}

.gb-modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--gb-text-secondary, #999);
  padding: 8px;
  line-height: 1;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--gb-border-radius, 8px);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.gb-modal-close:hover { color: var(--gb-text, #333); }
.gb-modal-close:active { background: var(--gb-bg-secondary, #f7f8fa); }

.gb-modal-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 20px;
  color: var(--gb-text, #333);
}

.gb-modal-desc {
  font-size: 13px;
  color: var(--gb-text-secondary, #666);
  margin: 0 0 16px;
  line-height: 1.5;
}

.gb-field { margin-bottom: 14px; }

.gb-field-row {
  display: flex;
  align-items: center;
  margin-bottom: 14px;
  gap: 10px;
}

.gb-field-row .gb-label {
  flex-shrink: 0;
  width: 70px;
  text-align: right;
  margin-bottom: 0;
}

.gb-field-row .gb-input {
  flex: 1;
  min-width: 0;
}

.gb-label {
  display: block;
  font-size: 13px;
  margin-bottom: 4px;
  color: var(--gb-text-secondary, #666);
}

.gb-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--gb-border, #e0e0e0);
  border-radius: var(--gb-border-radius, 8px);
  font-size: 16px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--gb-bg, #fff);
  color: var(--gb-text, #333);
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}
.gb-input:focus { outline: none; border-color: var(--gb-primary, #4a6cf7); }

.gb-hint {
  font-size: 12px;
  color: var(--gb-text-secondary, #999);
  margin-top: 4px;
}

.gb-error {
  color: var(--gb-danger, #e74c3c);
  font-size: 13px;
  margin-bottom: 12px;
}

.gb-success {
  color: var(--gb-success, #27ae60);
  font-size: 13px;
  margin-bottom: 12px;
}

.gb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: var(--gb-border-radius, 8px);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}

.gb-btn-primary {
  background: var(--gb-primary, #4a6cf7);
  color: #fff;
}
.gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.gb-btn-block {
  display: flex;
  width: 100%;
}

.gb-modal-links {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
}

.gb-link-btn {
  background: none;
  border: none;
  color: var(--gb-primary, #4a6cf7);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.gb-link-btn:active { opacity: 0.7; }

/* 移动端适配 */
@media (max-width: 480px) {
  .gb-modal-overlay {
    padding: 0;
    align-items: flex-end;
  }
  .gb-modal {
    padding: 20px 16px;
    max-height: 95vh;
    border-radius: var(--gb-border-radius, 8px) var(--gb-border-radius, 8px) 0 0;
  }
  .gb-modal-title {
    font-size: 16px;
    padding-right: 36px;
  }
  .gb-modal-links {
    flex-direction: column;
    gap: 8px;
    align-items: center;
  }
  .gb-field-row {
    flex-direction: column;
    align-items: stretch;
  }
  .gb-field-row .gb-label {
    width: auto;
    text-align: left;
  }
}

/* 桌面端 hover 效果（移动端不应用，避免双击问题） */
@media (hover: hover) {
  .gb-modal-close:hover { color: var(--gb-text, #333); }
  .gb-btn-primary:hover { background: var(--gb-primary-hover, #3b5de7); }
  .gb-link-btn:hover { text-decoration: underline; }
}
</style>
