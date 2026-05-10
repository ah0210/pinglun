// src/widget/entry.ts — Widget Web Component 入口 + 全局 API
import { defineCustomElement, watch } from 'vue';
import GuestBoard from './components/GuestBoard.ce.vue';
import AuthBar from './components/AuthBar.ce.vue';
import { useAuth, initAuth } from './composables/useAuth';
import type { PublicUser } from '../shared/types';
import type { WidgetOptions } from '../shared/types';

// AuthModalMode 类型定义（与 AuthModal.vue 中保持一致）
type AuthModalMode = 'login' | 'register' | 'forgot-password' | 'reset-password' | 'change-password' | 'change-email';

// 注册 Web Components
const GuestbookWidgetElement = defineCustomElement(GuestBoard);
customElements.define('guestbook-widget', GuestbookWidgetElement);

const AuthBarElement = defineCustomElement(AuthBar);
customElements.define('gb-auth-bar', AuthBarElement);

// ===== 全局 API =====
interface GuestBoardAPI {
  /** 获取当前用户状态 */
  getUser(): PublicUser | null;

  /** 打开认证弹窗 */
  openAuth(mode: AuthModalMode): void;

  /** 退出登录 */
  logout(): Promise<void>;

  /** 监听认证状态变化，返回取消监听函数 */
  onAuthChange(callback: (user: PublicUser | null) => void): () => void;

  /** 挂载认证栏到指定容器 */
  mountAuthBar(containerOrSelector: HTMLElement | string, options?: AuthBarOptions): void;

  /** 卸载认证栏 */
  unmountAuthBar(): void;
}

interface AuthBarOptions {
  showEmail?: boolean;
  showVerifiedStatus?: boolean;
  avatarSize?: number;
}

let authBarContainer: HTMLElement | null = null;
let authBarElement: Element | null = null;

function createGuestBoardAPI(): GuestBoardAPI {
  return {
    getUser() {
      const auth = useAuth();
      return auth.user.value;
    },

    openAuth(mode: AuthModalMode) {
      document.dispatchEvent(new CustomEvent('gb-open-auth', {
        detail: { mode },
        bubbles: true,
        composed: true,
      }));
    },

    async logout() {
      const auth = useAuth();
      await auth.logout();
    },

    onAuthChange(callback: (user: PublicUser | null) => void): () => void {
      const auth = useAuth();
      const unwatch = watch(() => auth.user.value, (newUser) => {
        callback(newUser);
      }, { immediate: true });
      return unwatch;
    },

    mountAuthBar(containerOrSelector: HTMLElement | string, options?: AuthBarOptions) {
      const container = typeof containerOrSelector === 'string'
        ? document.querySelector(containerOrSelector)
        : containerOrSelector;

      if (!container) {
        console.warn('[GuestBoard] mountAuthBar: container not found');
        return;
      }

      // 移除已有实例
      this.unmountAuthBar();

      // 获取 apiBase：从已有的 guestbook-widget 或通过 options
      const existingWidget = document.querySelector('guestbook-widget') as any;
      const apiBase = existingWidget?.apiBase || '';

      if (!apiBase) {
        console.warn('[GuestBoard] mountAuthBar: cannot determine apiBase. Please ensure a guestbook-widget exists on the page.');
        return;
      }

      const el = document.createElement('gb-auth-bar') as any;
      el.apiBase = apiBase;
      if (options?.showEmail !== undefined) el.showEmail = options.showEmail;
      if (options?.showVerifiedStatus !== undefined) el.showVerifiedStatus = options.showVerifiedStatus;
      if (options?.avatarSize !== undefined) el.avatarSize = options.avatarSize;

      container.appendChild(el);
      authBarContainer = container as HTMLElement;
      authBarElement = el;
    },

    unmountAuthBar() {
      if (authBarElement && authBarContainer) {
        authBarContainer.removeChild(authBarElement);
      }
      authBarElement = null;
      authBarContainer = null;
    },
  };
}

// 全局初始化 API
interface GuestbookWidgetAPI {
  init: (options: WidgetOptions) => void;
}

declare global {
  interface Window {
    GuestbookWidget: GuestbookWidgetAPI;
    GuestBoard: GuestBoardAPI;
    /** @deprecated 使用 GuestbookWidget */
    LiuyanBoard: GuestbookWidgetAPI;
  }
}

function createWidget(options: WidgetOptions) {
  const container = document.querySelector(options.container);
  if (!container) {
    console.warn(`[GuestbookWidget] Container not found: ${options.container}`);
    return;
  }

  const board = document.createElement('guestbook-widget') as any;
  board.pageId = options.pageId;
  board.apiBase = options.apiBase;
  board.siteKey = options.siteKey || '';
  board.theme = options.theme || 'auto';
  board.maxLength = options.maxLength || 500;

  container.appendChild(board);
}

window.GuestbookWidget = { init: createWidget };
window.LiuyanBoard = { init: createWidget };
window.GuestBoard = createGuestBoardAPI();
