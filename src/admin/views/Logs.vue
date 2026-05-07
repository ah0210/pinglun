<!-- src/admin/views/Logs.vue — 操作日志 -->
<template>
  <div>
    <n-h2>操作日志</n-h2>
    <n-space style="margin-bottom: 16px;">
      <n-input v-model:value="filters.action" placeholder="操作类型" style="width: 150px" clearable />
      <n-input v-model:value="filters.adminId" placeholder="管理员ID" style="width: 120px" clearable />
    </n-space>

    <n-data-table :columns="columns" :data="logs" :loading="loading" />

    <n-pagination style="margin-top: 16px; justify-content: center;" :page="page" :page-count="totalPages" @update:page="fetchLogs" />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue';
import { NH2, NSpace, NInput, NDataTable, NPagination } from 'naive-ui';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const logs = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const totalPages = ref(1);
const filters = reactive({ action: '', adminId: '' });

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '管理员', key: 'adminUsername', width: 100 },
  { title: '操作', key: 'action', width: 150 },
  { title: '对象类型', key: 'targetType', width: 80 },
  { title: '对象ID', key: 'targetId', width: 80 },
  { title: '详情', key: 'detail', ellipsis: { tooltip: true } },
  { title: 'IP', key: 'ipAddress', width: 130 },
  { title: '时间', key: 'createdAt', width: 160 },
];

async function fetchLogs(p = 1) {
  loading.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (filters.action) params.set('action', filters.action);
    if (filters.adminId) params.set('admin_id', filters.adminId);

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
</script>
