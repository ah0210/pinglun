<!-- src/admin/views/Logs.vue — 操作日志 -->
<template>
  <div>
    <n-h2>操作日志</n-h2>
    <n-space style="margin-bottom: 16px;">
      <n-select v-model:value="filters.action" :options="actionOptions" placeholder="操作类型" style="width: 160px" clearable />
      <n-input v-model:value="filters.search" placeholder="搜索详情/管理员" style="width: 200px" clearable @keyup.enter="fetchLogs()" />
      <n-button type="primary" @click="fetchLogs()">搜索</n-button>
    </n-space>

    <n-data-table :columns="columns" :data="logs" :loading="loading" />

    <n-pagination style="margin-top: 16px; justify-content: center;" :page="page" :page-count="totalPages" @update:page="fetchLogs" />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted, watch, h } from 'vue';
import { NH2, NSpace, NSelect, NInput, NButton, NDataTable, NPagination, NTag } from 'naive-ui';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const logs = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const totalPages = ref(1);
const filters = reactive({ action: null as string | null, search: '' });

const actionOptions = [
  { label: '审核留言', value: 'approve_message' },
  { label: '拒绝留言', value: 'reject_message' },
  { label: '删除留言', value: 'delete_message' },
  { label: '批量删除留言', value: 'batch_delete_messages' },
  { label: '更新用户', value: 'update_user' },
  { label: '更新配置', value: 'update_config' },
  { label: '手动清理', value: 'manual_cleanup' },
];

const actionLabelMap: Record<string, string> = {
  approve_message: '审核留言',
  reject_message: '拒绝留言',
  delete_message: '删除留言',
  batch_delete_messages: '批量删除留言',
  update_user: '更新用户',
  update_config: '更新配置',
  manual_cleanup: '手动清理',
};

const actionTagTypeMap: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  approve_message: 'success',
  reject_message: 'warning',
  delete_message: 'error',
  batch_delete_messages: 'error',
  update_user: 'info',
  update_config: 'info',
  manual_cleanup: 'info',
};

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '管理员', key: 'adminUsername', width: 100 },
  {
    title: '操作', key: 'action', width: 120,
    render: (row: any) => {
      const label = actionLabelMap[row.action] || row.action;
      const type = actionTagTypeMap[row.action] || 'default';
      return h(NTag, { type, size: 'small' }, () => label);
    },
  },
  { title: '对象类型', key: 'targetType', width: 80 },
  { title: '对象ID', key: 'targetId', width: 80 },
  { title: '详情', key: 'detail', ellipsis: { tooltip: true } },
  { title: 'IP', key: 'ipAddress', width: 130 },
  { title: '时间', key: 'createdAt', width: 170, render: (row: any) => formatTime(row.createdAt) },
];

async function fetchLogs(p = 1) {
  loading.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (filters.action) params.set('action', filters.action);
    if (filters.search) params.set('search', filters.search);

    const resp = await fetch(`/api/v1/admin/logs?${params}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` },
      credentials: 'include',
    });
    const data = await resp.json();
    if (data.success) {
      logs.value = data.data.items;
      totalPages.value = data.data.totalPages;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => fetchLogs());

// 筛选条件变化时自动查询
watch(() => filters.action, () => fetchLogs());
// 搜索框清空时自动查询
watch(() => filters.search, (val, oldVal) => {
  if (oldVal && !val) fetchLogs();
});

function formatTime(utcStr: string | null | undefined): string {
  if (!utcStr) return '-';
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
</script>
