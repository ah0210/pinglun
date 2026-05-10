<!-- src/admin/views/Messages.vue — 留言管理 -->
<template>
  <div>
    <n-h2>留言管理</n-h2>
    <n-space style="margin-bottom: 16px;">
      <n-select v-model:value="filters.status" :options="statusOptions" placeholder="状态筛选" style="width: 120px" clearable />
      <n-select v-model:value="filters.isSecret" :options="secretOptions" placeholder="类型筛选" style="width: 120px" clearable />
      <n-input v-model:value="filters.search" placeholder="搜索留言内容" style="width: 200px" clearable @keyup.enter="fetchMessages()" />
      <n-button type="primary" @click="fetchMessages()">搜索</n-button>
      <n-button type="error" :disabled="checkedIds.length === 0" @click="handleBatchDelete">
        批量删除 ({{ checkedIds.length }})
      </n-button>
    </n-space>

    <n-data-table
      :columns="columns"
      :data="messages"
      :loading="loading"
      :row-key="(row: any) => row.id"
      v-model:checked-row-keys="checkedIds"
    />

    <n-pagination
      style="margin-top: 16px; justify-content: center;"
      :page="page"
      :page-count="totalPages"
      @update:page="fetchMessages"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted, h, watch } from 'vue';
import { NH2, NSpace, NSelect, NInput, NButton, NDataTable, NPagination, NTag, useMessage, useDialog } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import type { PublicMessage } from '../../shared/types';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const message = useMessage();
const dialog = useDialog();

const messages = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const totalPages = ref(1);
const checkedIds = ref<(number | string)[]>([]);

const filters = reactive({ status: null as string | null, isSecret: null as string | null, search: '' });

const statusOptions = [
  { label: '已通过', value: 'approved' },
  { label: '待审核', value: 'pending' },
  { label: '已拒绝', value: 'rejected' },
];
const secretOptions = [
  { label: '公开', value: '0' },
  { label: '秘密', value: '1' },
];

const columns: DataTableColumns<any> = [
  { type: 'selection' },
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户', key: 'user', width: 120, render: (row) => row.user?.displayName || row.user?.username },
  { title: '内容', key: 'content', ellipsis: { tooltip: true } },
  { title: '页面', key: 'pageId', width: 150, ellipsis: { tooltip: true } },
  {
    title: '类型', key: 'isSecret', width: 70,
    render: (row) => row.isSecret ? h(NTag, { type: 'warning', size: 'small' }, () => '秘密') : h(NTag, { size: 'small' }, () => '公开'),
  },
  {
    title: '状态', key: 'status', width: 80,
    render: (row) => {
      const map: Record<string, { type: 'success' | 'warning' | 'error'; label: string }> = {
        approved: { type: 'success', label: '通过' },
        pending: { type: 'warning', label: '待审' },
        rejected: { type: 'error', label: '拒绝' },
      };
      const s = map[row.status] || { type: 'default' as any, label: row.status };
      return h(NTag, { type: s.type, size: 'small' }, () => s.label);
    },
  },
  { title: '时间', key: 'createdAt', width: 170, render: (row) => formatTime(row.createdAt) },
  {
    title: '操作', key: 'actions', width: 160,
    render: (row) => {
      const btns: any[] = [];
      if (row.status === 'pending') {
        btns.push(h(NButton, { size: 'tiny', type: 'success', onClick: () => handleApprove(row.id) }, () => '通过'));
        btns.push(h(NButton, { size: 'tiny', type: 'warning', onClick: () => handleReject(row.id) }, () => '拒绝'));
      }
      btns.push(h(NButton, { size: 'tiny', type: 'error', onClick: () => handleDelete(row.id) }, () => '删除'));
      return h(NSpace, { size: 4 }, () => btns);
    },
  },
];

async function fetchMessages(p = 1) {
  loading.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (filters.status) params.set('status', filters.status);
    if (filters.isSecret !== null) params.set('is_secret', filters.isSecret);
    if (filters.search) params.set('search', filters.search);

    const resp = await fetch(`/api/v1/admin/messages?${params}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` },
      credentials: 'include',
    });
    const data = await resp.json();
    if (data.success) {
      messages.value = data.data.items;
      totalPages.value = data.data.totalPages;
    }
  } finally {
    loading.value = false;
  }
}

async function handleApprove(id: number) {
  const resp = await fetch(`/api/v1/admin/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'approved' }),
  });
  const data = await resp.json();
  if (data.success) { message.success('已通过'); fetchMessages(page.value); }
  else message.error(data.error?.message || '操作失败');
}

async function handleReject(id: number) {
  const resp = await fetch(`/api/v1/admin/messages/${id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'rejected' }),
  });
  const data = await resp.json();
  if (data.success) { message.success('已拒绝'); fetchMessages(page.value); }
  else message.error(data.error?.message || '操作失败');
}

async function handleDelete(id: number) {
  dialog.warning({
    title: '确认删除',
    content: '删除后不可恢复，确定删除此留言？',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const resp = await fetch(`/api/v1/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authStore.token}` },
        credentials: 'include',
      });
      const data = await resp.json();
      if (data.success) { message.success('已删除'); fetchMessages(page.value); }
      else message.error(data.error?.message || '删除失败');
    },
  });
}

async function handleBatchDelete() {
  dialog.error({
    title: '批量删除',
    content: `确定删除选中的 ${checkedIds.value.length} 条留言？此操作不可恢复。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const ids = checkedIds.value.map(Number);
        const resp = await fetch('/api/v1/admin/messages/batch-delete', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ids }),
        });
        const data = await resp.json();
        if (data.success) {
          message.success(`已删除 ${data.data.deleted} 条`);
          checkedIds.value = [];
          fetchMessages(page.value);
        } else {
          message.error(data.error?.message || '删除失败');
        }
      } catch (e: any) {
        message.error(e.message || '网络错误');
      }
    },
  });
}

onMounted(() => fetchMessages());

// 筛选条件变化时自动查询
watch(() => [filters.status, filters.isSecret], () => fetchMessages());
// 搜索框清空时自动查询
watch(() => filters.search, (val, oldVal) => {
  if (oldVal && !val) fetchMessages();
});

function formatTime(utcStr: string | null | undefined): string {
  if (!utcStr) return '-';
  // D1 datetime('now') 返回 UTC 格式 "2025-05-10 08:53:00"，没有时区后缀
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
</script>
