// src/widget/entry.ts — Widget Web Component 入口
import { defineCustomElement } from 'vue';
import GuestBoard from './components/GuestBoard.ce.vue';
import type { WidgetOptions } from '../shared/types';

// 注册 Web Component
const LiuyanBoardElement = defineCustomElement(GuestBoard);
customElements.define('liuyan-board', LiuyanBoardElement);

// 全局初始化 API
interface LiuyanBoardAPI {
  init: (options: WidgetOptions) => void;
}

declare global {
  interface Window {
    LiuyanBoard: LiuyanBoardAPI;
  }
}

window.LiuyanBoard = {
  init(options: WidgetOptions) {
    const container = document.querySelector(options.container);
    if (!container) {
      console.warn(`[LiuyanBoard] Container not found: ${options.container}`);
      return;
    }

    const board = document.createElement('liuyan-board') as any;
    board.pageId = options.pageId;
    board.apiBase = options.apiBase;
    board.siteKey = options.siteKey;
    board.theme = options.theme || 'auto';
    board.maxLength = options.maxLength || 500;

    container.appendChild(board);
  },
};
