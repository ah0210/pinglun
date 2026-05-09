// src/widget/composables/useMessages.ts — 留言 CRUD

import { ref } from 'vue';
import { apiGet, apiPost } from '../../shared/api';
import type { PublicMessage, PaginatedResponse, BoardConfig } from '../../shared/types';

export function useMessages(apiBase: string) {
  const messages = ref<PublicMessage[]>([]);
  const total = ref(0);
  const page = ref(1);
  const totalPages = ref(0);
  const loading = ref(false);
  const config = ref<BoardConfig | null>(null);

  async function fetchMessages(pageId: string, pageNum = 1, limit = 20, showLoading = true) {
    if (showLoading) loading.value = true;
    try {
      const cacheBust = showLoading ? '' : `&t=${Date.now()}`;
      const resp = await apiGet<PaginatedResponse<PublicMessage>>(
        apiBase,
        `/messages?pageId=${encodeURIComponent(pageId)}&page=${pageNum}&limit=${limit}${cacheBust}`
      );

      if (resp.success && resp.data) {
        messages.value = resp.data.items;
        total.value = resp.data.total;
        page.value = resp.data.page;
        totalPages.value = resp.data.totalPages;
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

  async function postMessage(data: {
    content: string;
    pageId: string;
    isSecret?: boolean;
    turnstileToken?: string;
  }) {
    const resp = await apiPost<PublicMessage>(apiBase, '/messages', data);
    if (resp.success) {
      // 发帖成功后重新拉取列表（跳回第1页以显示最新留言）
      await fetchMessages(data.pageId, 1, 20, false);
    }
    return resp;
  }

  return {
    messages,
    total,
    page,
    totalPages,
    loading,
    config,
    fetchMessages,
    fetchConfig,
    postMessage,
  };
}
