// src/widget/utils/turnstile.ts — Turnstile SDK 动态加载与验证工具

/** Turnstile SDK URL（explicit render 模式，需手动调 render） */
const TURNSTILE_SDK_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** SDK 加载 Promise（单例，避免重复加载） */
let sdkLoadPromise: Promise<boolean> | null = null;

/**
 * 确保 Turnstile SDK 已加载到 window.turnstile
 * - 已加载：直接返回 true
 * - 未加载：动态注入 SDK script，等待 onload
 * - 加载失败：返回 false
 * @returns Promise<boolean> - SDK 是否可用
 */
export async function ensureTurnstileSDK(): Promise<boolean> {
  if ((window as any).turnstile) return true;

  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true;
        if (!ready) sdkLoadPromise = null;
        resolve(ready);
      };

      /** 安全超时：10s 内 SDK 未加载视为失败，允许下次重试 */
      const timeout = setTimeout(() => finish(false), 10000);

      /** 避免重复注入 script 标签 */
      const existing = document.getElementById('turnstile-sdk') ||
        document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
      if (existing) {
        /** script 已存在但 SDK 未就绪，等 onload */
        existing.addEventListener('load', () => {
          clearTimeout(timeout);
          finish(!!(window as any).turnstile);
        });
        existing.addEventListener('error', () => {
          clearTimeout(timeout);
          finish(false);
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'turnstile-sdk';
      script.src = TURNSTILE_SDK_URL;
      script.async = true;
      script.addEventListener('load', () => {
        clearTimeout(timeout);
        finish(!!(window as any).turnstile);
      });
      script.addEventListener('error', () => {
        clearTimeout(timeout);
        finish(false);
      });
      document.head.appendChild(script);
    });
  }

  return sdkLoadPromise;
}

/**
 * 渲染 Turnstile Widget 并等待验证 token（render 模式，无竞态）
 * - render 模式：render() 时 SDK 自动触发验证，callback 直接返回 token
 * - 不使用 execute()，避免 iframe 未就绪时竞态失败
 * @param containerId - 挂载容器的 DOM ID
 * @param siteKey - Turnstile Site Key
 * @param options - 可选配置
 * @returns Promise<string> - 验证完成后返回 token，失败/超时返回空串
 */
export function renderTurnstileWidget(
  containerId: string,
  siteKey: string,
  options?: {
    size?: 'normal' | 'compact';
    timeout?: number;
    action?: string;
  }
): Promise<string> {
  const timeoutMs = options?.timeout || 30000;

  return new Promise((resolve) => {
    const turnstile = (window as any).turnstile;
    if (!turnstile || !siteKey) {
      console.warn('[Guestbook] Turnstile not available, skipping captcha');
      resolve('');
      return;
    }

    const timeout = setTimeout(() => {
      console.warn('[Guestbook] Turnstile verification timed out');
      resolve('');
    }, timeoutMs);

    try {
      turnstile.render(`#${containerId}`, {
        sitekey: siteKey,
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
        size: options?.size || 'compact',
        action: options?.action,
      });
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[Guestbook] Turnstile render failed:', e);
      resolve('');
    }
  });
}

export async function getTurnstileToken(
  siteKey: string,
  options?: {
    action?: string;
    forceSkip?: boolean;
    size?: 'normal' | 'compact';
    timeout?: number;
  }
): Promise<string> {
  if (options?.forceSkip) return '';

  if (!siteKey) {
    throw new Error('验证码未配置，请联系管理员');
  }

  const sdkReady = await ensureTurnstileSDK();
  if (!sdkReady) {
    throw new Error('验证码加载失败，请检查网络后重试');
  }

  const containerId = `gb-turnstile-${options?.action || 'verify'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const container = document.createElement('div');
  container.id = containerId;
  container.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:99999;';
  document.body.appendChild(container);

  try {
    return await new Promise<string>((resolve, reject) => {
      const turnstile = (window as any).turnstile;
      let widgetId: string | null = null;
      const timeout = setTimeout(() => {
        removeTurnstileWidget(widgetId);
        reject(new Error('验证码验证超时，请重试'));
      }, options?.timeout || 30000);

      try {
        widgetId = turnstile.render(`#${containerId}`, {
          sitekey: siteKey,
          execution: 'render',
          callback: (token: string) => {
            clearTimeout(timeout);
            removeTurnstileWidget(widgetId);
            token ? resolve(token) : reject(new Error('验证码验证失败，请重试'));
          },
          'error-callback': () => {
            clearTimeout(timeout);
            removeTurnstileWidget(widgetId);
            reject(new Error('验证码验证失败，请重试'));
          },
          'expired-callback': () => {
            clearTimeout(timeout);
            removeTurnstileWidget(widgetId);
            reject(new Error('验证码已过期，请重试'));
          },
          size: options?.size || 'compact',
          action: options?.action,
        });
      } catch {
        clearTimeout(timeout);
        removeTurnstileWidget(widgetId);
        reject(new Error('验证码初始化失败，请重试'));
      }
    });
  } finally {
    container.remove();
  }
}

/**
 * 移除 Turnstile Widget
 * @param widgetId - render() 返回的 widget ID
 */
export function removeTurnstileWidget(widgetId: string | null): void {
  const turnstile = (window as any).turnstile;
  if (turnstile && widgetId) {
    try { turnstile.remove(widgetId); } catch {}
  }
}
