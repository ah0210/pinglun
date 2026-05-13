<!-- src/admin/views/Users.vue — 用户管理 -->
<template>
  <div>
    <n-h2>用户管理</n-h2>
    <n-space style="margin-bottom: 16px;">
      <n-select v-model:value="filters.role" :options="roleOptions" placeholder="角色筛选" style="width: 120px" clearable />
      <n-select v-model:value="filters.status" :options="userStatusOptions" placeholder="状态筛选" style="width: 120px" clearable />
      <n-input v-model:value="filters.search" placeholder="搜索用户名/邮箱/手机号" style="width: 200px" clearable @keyup.enter="fetchUsers()" />
      <n-button type="primary" @click="fetchUsers()">搜索</n-button>
    </n-space>

    <n-data-table :columns="columns" :data="users" :loading="loading" />

    <n-pagination style="margin-top: 16px; justify-content: center;" :page="page" :page-count="totalPages" @update:page="fetchUsers" />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted, h, watch } from 'vue';
import { NH2, NSpace, NSelect, NInput, NButton, NDataTable, NPagination, NTag, useMessage, useDialog } from 'naive-ui';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const message = useMessage();
const dialog = useDialog();

const users = ref<any[]>([]);
const loading = ref(false);
const page = ref(1);
const totalPages = ref(1);
const filters = reactive({ role: null as string | null, status: null as string | null, search: '' });

const roleOptions = [
  { label: '普通用户', value: 'user' },
  { label: '管理员', value: 'admin' },
];
const userStatusOptions = [
  { label: '正常', value: 'active' },
  { label: '禁用', value: 'disabled' },
  { label: '封禁', value: 'banned' },
];

const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '头像', key: 'avatar', width: 60, render: (row: any) => h('img', { src: row.avatar, style: 'width:32px;height:32px;border-radius:50%;' }) },
  { title: '用户名', key: 'username', width: 120 },
  { title: '显示名', key: 'displayName', width: 120 },
  { title: '邮箱', key: 'email', width: 180 },
  { title: '手机号', key: 'phone', width: 130, render: (row: any) => row.phone || '-' },
  { title: '邮箱验证', key: 'emailVerified', width: 90, render: (row: any) => row.emailVerified ? h(NTag, { type: 'success', size: 'small' }, () => '已验证') : h(NTag, { type: 'warning', size: 'small' }, () => '未验证') },
  { title: '角色', key: 'role', width: 80, render: (row: any) => row.role === 'admin' ? h(NTag, { type: 'info', size: 'small' }, () => '管理员') : h(NTag, { size: 'small' }, () => '用户') },
  { title: '状态', key: 'status', width: 80, render: (row: any) => {
    const map: Record<string, any> = { active: { type: 'success', label: '正常' }, disabled: { type: 'warning', label: '禁用' }, banned: { type: 'error', label: '封禁' } };
    const s = map[row.status] || { type: 'default', label: row.status };
    return h(NTag, { type: s.type, size: 'small' }, () => s.label);
  }},
  { title: '注册时间', key: 'createdAt', width: 170, render: (row: any) => formatTime(row.createdAt) },
  { title: '验证时间', key: 'emailVerifiedAt', width: 170, render: (row: any) => row.emailVerifiedAt ? formatTime(row.emailVerifiedAt) : '-' },
  {
    title: '操作', key: 'actions', width: 240,
    render: (row: any) => {
      if (row.id === authStore.user?.id) return h('span', { style: 'color: #999' }, '当前用户');
      const btns: any[] = [];
      if (row.status === 'active') {
        btns.push(h(NButton, { size: 'tiny', type: 'warning', onClick: () => handleStatus(row.id, 'disabled') }, () => '禁用'));
      } else if (row.status === 'disabled' || row.status === 'banned') {
        btns.push(h(NButton, { size: 'tiny', type: 'success', onClick: () => handleStatus(row.id, 'active') }, () => '解禁'));
      }
      if (row.role === 'user') {
        btns.push(h(NButton, { size: 'tiny', type: 'info', onClick: () => handleRole(row.id, 'admin') }, () => '升为管理员'));
      } else {
        btns.push(h(NButton, { size: 'tiny', onClick: () => handleRole(row.id, 'user') }, () => '降为用户'));
      }
      if (row.role !== 'admin') {
        btns.push(h(NButton, { size: 'tiny', type: 'error', onClick: () => handleDelete(row.id, row.username) }, () => '删除'));
      }
      return h(NSpace, { size: 4 }, () => btns);
    },
  },
];

async function fetchUsers(p = 1) {
  loading.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);

    const resp = await fetch(`/api/v1/admin/users?${params}`, {
      headers: { 'Authorization': `Bearer ${authStore.token}` },
      credentials: 'include',
    });
    const data = await resp.json();
    if (data.success) {
      users.value = data.data.items;
      totalPages.value = data.data.totalPages;
    }
  } finally {
    loading.value = false;
  }
}

async function handleRole(id: number, role: string) {
  const label = role === 'admin' ? '升级为管理员' : '降级为普通用户';
  dialog.warning({
    title: '确认操作',
    content: `确定将此用户${label}？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const resp = await fetch(`/api/v1/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role }),
      });
      const data = await resp.json();
      if (data.success) { message.success('操作成功'); fetchUsers(page.value); }
      else message.error(data.error?.message || '操作失败');
    },
  });
}

async function handleStatus(id: number, status: string) {
  const resp = await fetch(`/api/v1/admin/users/${id}`, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${authStore.token}`, 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  const data = await resp.json();
  if (data.success) { message.success('操作成功'); fetchUsers(page.value); }
  else message.error(data.error?.message || '操作失败');
}

/**
 * 删除非管理员用户
 * @param id - 用户ID
 * @param username - 用户名，用于确认弹窗提示
 */
async function handleDelete(id: number, username: string) {
  dialog.error({
    title: '确认删除',
    content: `确定删除用户「${username}」？该用户的留言也将一并删除，此操作不可撤销！`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const resp = await fetch(`/api/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authStore.token}` },
        credentials: 'include',
      });
      const data = await resp.json();
      if (data.success) { message.success('用户已删除'); fetchUsers(page.value); }
      else message.error(data.error?.message || '删除失败');
    },
  });
}

onMounted(() => fetchUsers());

// 筛选条件变化时自动查询
watch(() => [filters.role, filters.status], () => fetchUsers());
// 搜索框清空时自动查询
watch(() => filters.search, (val, oldVal) => {
  if (oldVal && !val) fetchUsers();
});

function formatTime(utcStr: string | null | undefined): string {
  if (!utcStr) return '-';
  const d = new Date(utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
</script>
