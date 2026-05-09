// src/widget/entry.ts — Widget Web Component 入口
import { defineCustomElement } from 'vue';
import GuestBoard from './components/GuestBoard.ce.vue';
import type { WidgetOptions } from '../shared/types';

// 注册 Web Component
const GuestbookWidgetElement = defineCustomElement(GuestBoard);
customElements.define('guestbook-widget', GuestbookWidgetElement);

// 全局初始化 API
interface GuestbookWidgetAPI {
  init: (options: WidgetOptions) => void;
}

declare global {
  interface Window {
    GuestbookWidget: GuestbookWidgetAPI;
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
// 兼容旧名
window.LiuyanBoard = { init: createWidget };
