// src/widget/composables/useMessages.ts — 留言 CRUD（游标分页）

import { ref } from 'vue';
import { apiGet, apiPost } from '../../shared/api';
import type { PublicMessage, CursorPaginatedResponse, BoardConfig } from '../../shared/types';

export function useMessages(apiBase: string) {
  const messages = ref<PublicMessage[]>([]);
  const hasMore = ref(true);
  const loading = ref(false);
  const nextCursor = ref<string | null>(null);
  const config = ref<BoardConfig | null>(null);

  async function fetchMessages(pageId: string, cursor = '', limit = 20, showLoading = true) {
    if (showLoading) loading.value = true;
    try {
      const cacheBust = showLoading ? '' : `&t=${Date.now()}`;
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const resp = await apiGet<CursorPaginatedResponse<PublicMessage>>(
        apiBase,
        `/messages?pageId=${encodeURIComponent(pageId)}&limit=${limit}${cursorParam}${cacheBust}`
      );

      if (resp.success && resp.data) {
        messages.value = resp.data.items;
        hasMore.value = resp.data.hasMore;
        nextCursor.value = resp.data.nextCursor;
      }
    } finally {
      loading.value = false;
    }
  }

  /** 加载下一页（追加模式） */
  async function loadMore(pageId: string, limit = 20) {
    if (!hasMore.value || !nextCursor.value) return;
    loading.value = true;
    try {
      const resp = await apiGet<CursorPaginatedResponse<PublicMessage>>(
        apiBase,
        `/messages?pageId=${encodeURIComponent(pageId)}&limit=${limit}&cursor=${encodeURIComponent(nextCursor.value)}`
      );

      if (resp.success && resp.data) {
        messages.value = [...messages.value, ...resp.data.items];
        hasMore.value = resp.data.hasMore;
        nextCursor.value = resp.data.nextCursor;
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchConfig() {
    const resp = await apiGet<BoardConfig>(apiBase, '/config');
    if (resp.success && resp.data) {
      config.value = resp.data;
    }
  }

  /**
   * 提交留言，自动注入宿主页面完整 URL（pageUrl）
   * @param data - 留言数据（content, pageId, isSecret, replyTo, turnstileToken）
   * @returns API 响应
   */
  async function postMessage(data: {
    content: string;
    pageId: string;
    isSecret?: boolean;
    replyTo?: number;
    turnstileToken?: string;
  }) {
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    const resp = await apiPost<PublicMessage>(apiBase, '/messages', { ...data, pageUrl });
    if (resp.success) {
      // 发帖成功后重新拉取列表（从首页开始）
      await fetchMessages(data.pageId, '', 20, false);
    }
    return resp;
  }

  return {
    messages,
    hasMore,
    nextCursor,
    loading,
    config,
    fetchMessages,
    loadMore,
    fetchConfig,
    postMessage,
  };
}
