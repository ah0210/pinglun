// src/widget/styles/theme.ts — 共享样式单例（adoptedStyleSheets）
// 所有 Web Component（GuestBoard、AuthBar）共用同一个 CSSStyleSheet 对象
// 宿主页面通过 --guestbook-* CSS 变量自定义主题，变量穿透 Shadow DOM 生效

const css = `
/* ===== 主题变量（宿主页面可通过 --guestbook-* 覆盖） ===== */
:host {
  --gb-primary: var(--guestbook-primary, #4a6cf7);
  --gb-primary-hover: var(--guestbook-primary-hover, #3b5de7);
  --gb-bg: var(--guestbook-bg, #ffffff);
  --gb-bg-secondary: var(--guestbook-bg-secondary, #f7f8fa);
  --gb-text: var(--guestbook-text, #333333);
  --gb-text-secondary: var(--guestbook-text-secondary, #666666);
  --gb-border: var(--guestbook-border, #e0e0e0);
  --gb-border-radius: var(--guestbook-border-radius, 8px);
  --gb-shadow: var(--guestbook-shadow, 0 2px 8px rgba(0, 0, 0, 0.08));
  --gb-font-size: var(--guestbook-font-size, 14px);
  --gb-font-family: var(--guestbook-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
  --gb-danger: #e74c3c;
  --gb-success: #27ae60;
  --gb-warning: #f39c12;

  font-family: var(--gb-font-family);
  font-size: var(--gb-font-size);
  color: var(--gb-text);
}

:host([theme="dark"]) {
  --gb-bg: var(--guestbook-bg, #1a1a2e);
  --gb-bg-secondary: var(--guestbook-bg-secondary, #16213e);
  --gb-text: var(--guestbook-text, #e0e0e0);
  --gb-text-secondary: var(--guestbook-text-secondary, #a0a0a0);
  --gb-border: var(--guestbook-border, #2d2d44);
  --gb-shadow: var(--guestbook-shadow, 0 2px 8px rgba(0, 0, 0, 0.3));
}

/* ===== 按钮 ===== */
.gb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: var(--gb-border-radius);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-btn-primary { background: var(--gb-primary); color: #fff; }
.gb-btn-primary:active { background: var(--gb-primary-hover); }
.gb-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-outline { background: transparent; color: var(--gb-primary); border: 1px solid var(--gb-primary); }
.gb-btn-outline:active { background: var(--gb-bg-secondary); }
.gb-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.gb-btn-sm { padding: 5px 12px; font-size: 13px; min-height: 44px; }
.gb-btn-text { background: transparent; color: var(--gb-primary); padding: 8px 8px; }
.gb-btn-text:active { text-decoration: underline; }
.gb-btn-danger { background: var(--gb-danger); color: #fff; }

/* ===== 表单 ===== */
.gb-form { margin-bottom: 16px; }
.gb-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius);
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  background: var(--gb-bg);
  color: var(--gb-text);
  line-height: 1.5;
  box-sizing: border-box;
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.gb-textarea:focus { outline: none; border-color: var(--gb-primary); }
.gb-textarea::placeholder { color: var(--gb-text-secondary); }
.gb-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
.gb-input-group { margin-bottom: 12px; }
.gb-label { display: block; font-size: 13px; margin-bottom: 4px; color: var(--gb-text-secondary); }
.gb-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius);
  font-size: 16px;
  font-family: inherit;
  box-sizing: border-box;
  background: var(--gb-bg);
  color: var(--gb-text);
  -webkit-appearance: none;
  -webkit-tap-highlight-color: transparent;
}
.gb-input:focus { outline: none; border-color: var(--gb-primary); }
.gb-secret-toggle {
  display: inline-flex; align-items: center; gap: 4px; cursor: pointer;
  font-size: 13px; color: var(--gb-text-secondary); user-select: none;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation; min-height: 44px;
}
.gb-secret-toggle input[type="checkbox"] { margin: 0; cursor: pointer; width: 18px; height: 18px; }
.gb-error { color: var(--gb-danger); font-size: 13px; margin-top: 4px; padding: 8px 12px; background: rgba(231,76,60,0.08); border: 1px solid rgba(231,76,60,0.2); border-radius: var(--gb-border-radius); }
.gb-hint { font-size: 12px; color: var(--gb-text-secondary); margin-top: 6px; }

/* ===== 认证表单 ===== */
.gb-auth { margin-bottom: 20px; padding: 16px; background: var(--gb-bg-secondary); border-radius: var(--gb-border-radius); }
.gb-auth-title { font-size: 16px; font-weight: 500; margin: 0 0 12px; }
.gb-auth-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid var(--gb-border); }
.gb-auth-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  color: var(--gb-text-secondary);
  border-bottom: 2px solid transparent;
  font-family: inherit;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  min-height: 44px;
}
.gb-auth-tab.active { color: var(--gb-primary); border-bottom-color: var(--gb-primary); }

/* ===== 留言列表 ===== */
.gb-message-list { list-style: none; padding: 0; margin: 0; }
.gb-message-item {
  padding: 14px 0;
  border-bottom: 1px solid var(--gb-border);
}
.gb-message-item:last-child { border-bottom: none; }
.gb-message-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.gb-avatar {
  width: 36px; height: 36px; border-radius: 50%; object-fit: cover;
  background: var(--gb-bg-secondary);
}
.gb-message-meta { flex: 1; }
.gb-username { font-weight: 500; color: var(--gb-text); }
.gb-time { font-size: 12px; color: var(--gb-text-secondary); margin-left: 8px; }
.gb-secret-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 10px;
  background: var(--gb-warning); color: #fff; margin-left: 6px;
}
.gb-admin-badge {
  font-size: 11px; padding: 1px 6px; border-radius: 10px;
  background: var(--gb-primary); color: #fff; margin-left: 6px;
}
.gb-message-content { margin: 0; line-height: 1.6; word-break: break-word; color: var(--gb-text); }
.gb-secret-placeholder { color: var(--gb-text-secondary); font-style: italic; }

/* ===== 回复引用块 ===== */
.gb-reply-quote {
  margin-bottom: 8px; padding: 8px 12px;
  border-left: 3px solid var(--gb-primary);
  background: var(--gb-bg-secondary);
  border-radius: 0 var(--gb-border-radius) var(--gb-border-radius) 0;
  font-size: 13px; line-height: 1.5;
}
.gb-reply-quote-user { color: var(--gb-primary); font-weight: 500; margin-right: 4px; }
.gb-reply-quote-content { color: var(--gb-text-secondary); }

/* ===== 回复按钮 ===== */
.gb-message-actions { margin-top: 6px; }
.gb-btn-reply {
  background: none; border: none; color: var(--gb-text-secondary);
  font-size: 12px; cursor: pointer; padding: 4px 8px; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  min-height: 44px; display: inline-flex; align-items: center;
}
.gb-btn-reply:active { color: var(--gb-primary); }

/* ===== 内联回复表单 ===== */
.gb-inline-reply { margin-top: 10px; padding: 12px; background: var(--gb-bg-secondary); border-radius: var(--gb-border-radius); }
.gb-reply-target { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 8px; font-size: 13px; color: var(--gb-primary); }
.gb-reply-textarea { min-height: 60px; }
.gb-inline-reply-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }

/* ===== 分页 ===== */
.gb-pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 20px; }
.gb-page-btn {
  padding: 6px 12px; border: 1px solid var(--gb-border);
  border-radius: var(--gb-border-radius); background: var(--gb-bg);
  color: var(--gb-text); cursor: pointer; font-size: 13px; font-family: inherit;
  -webkit-tap-highlight-color: transparent; touch-action: manipulation; min-height: 44px;
}
.gb-page-btn:active { border-color: var(--gb-primary); color: var(--gb-primary); }
.gb-page-btn.active { background: var(--gb-primary); color: #fff; border-color: var(--gb-primary); }
.gb-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ===== 状态 ===== */
.gb-empty { text-align: center; padding: 40px 20px; color: var(--gb-text-secondary); }
.gb-loading { text-align: center; padding: 20px; color: var(--gb-text-secondary); }
.gb-status-pending { color: var(--gb-warning); font-size: 12px; }
.gb-status-approved { color: var(--gb-success); font-size: 12px; }

/* ===== Turnstile ===== */
.gb-turnstile { margin: 10px 0; }

/* ===== 版权信息 ===== */
.gb-footer {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--gb-border);
  font-size: 12px; color: var(--gb-text-secondary);
}
.gb-footer a { color: var(--gb-text-secondary); text-decoration: none; }
.gb-footer a:active { color: var(--gb-primary); }
.gb-version { opacity: 0.6; }

/* ===== 移动端适配 ===== */
@media (max-width: 480px) {
  .gb-container { padding: 12px; }
  .gb-header { flex-wrap: wrap; gap: 8px; }
  .gb-title { font-size: 18px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gb-auth-prompt { flex-wrap: wrap; padding: 10px 12px; }
  .gb-auth-hint { font-size: 13px; }
  .gb-verify-actions { flex-wrap: wrap; }
  .gb-textarea { min-height: 60px; }
  .gb-actions { gap: 8px; }
  .gb-hint { margin-left: 0; width: 100%; }
  .gb-message-header { gap: 8px; }
  .gb-message-meta { min-width: 0; overflow: hidden; }
  .gb-username {
    display: inline-block; max-width: 120px; overflow: hidden;
    text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;
  }
  .gb-time { display: block; margin-left: 0; margin-top: 2px; }
  .gb-inline-reply-actions { flex-wrap: wrap; }
  .gb-pagination { flex-wrap: wrap; }
  .gb-page-btn { padding: 5px 8px; font-size: 12px; }
  .gb-auth-tabs { overflow-x: auto; }
  .gb-input { font-size: 16px; }
}

/* ===== 桌面端 hover 效果（移动端不应用，避免双击问题） ===== */
@media (hover: hover) {
  .gb-btn-primary:hover { background: var(--gb-primary-hover); }
  .gb-btn-outline:hover { background: var(--gb-bg-secondary); }
  .gb-btn-text:hover { text-decoration: underline; }
  .gb-btn-reply:hover { color: var(--gb-primary); }
  .gb-page-btn:hover { border-color: var(--gb-primary); color: var(--gb-primary); }
  .gb-footer a:hover { color: var(--gb-primary); }
}
`;

// 创建单例 CSSStyleSheet，所有组件共享同一个对象引用
export const themeSheet = new CSSStyleSheet();
themeSheet.replaceSync(css);

/** 在组件 onMounted 中调用，将主题注入 Shadow DOM */
export function adoptTheme(shadowRoot: ShadowRoot) {
  if (!shadowRoot.adoptedStyleSheets.includes(themeSheet)) {
    shadowRoot.adoptedStyleSheets = [...shadowRoot.adoptedStyleSheets, themeSheet];
  }
}
