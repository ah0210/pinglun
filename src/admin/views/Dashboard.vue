<!-- src/admin/views/Dashboard.vue — 数据概览面板 -->
<template>
  <div>
    <n-h2>数据概览</n-h2>
    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="总留言数" :value="stats.totalMessages" prefix="💬" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="今日留言" :value="stats.todayMessages" prefix="📝" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="注册用户" :value="stats.totalUsers" prefix="👥" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="待审核" :value="stats.pendingMessages" prefix="⏳" />
      </n-gi>
    </n-grid>

    <n-card style="margin-top: 16px;" title="快捷操作">
      <n-space>
        <n-button @click="$router.push('/messages')">管理留言</n-button>
        <n-button @click="$router.push('/users')">管理用户</n-button>
        <n-button @click="$router.push('/config')">系统配置</n-button>
        <n-button type="warning" @click="handleCleanup" :loading="cleaning">手动清理</n-button>
      </n-space>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, reactive } from 'vue';
import { NGrid, NGi, NH2, NCard, NButton, NSpace, useMessage } from 'naive-ui';
import StatsCard from '../components/StatsCard.vue';
import type { AdminStats } from '../../shared/types';
import { useAuthStore } from '../stores/auth';

const authStore = useAuthStore();
const message = useMessage();
const cleaning = ref(false);

const stats = reactive<AdminStats>({
  totalMessages: 0,
  todayMessages: 0,
  totalUsers: 0,
  pendingMessages: 0,
  secretMessages: 0,
});

async function fetchStats() {
  const resp = await fetch('/api/v1/admin/stats', {
    headers: { 'Authorization': `Bearer ${authStore.token}` },
    credentials: 'include',
  });
  const data = await resp.json();
  if (data.success && data.data) {
    Object.assign(stats, data.data);
  }
}

async function handleCleanup() {
  cleaning.value = true;
  try {
    const resp = await fetch('/api/v1/admin/cleanup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    const data = await resp.json();
    if (data.success) {
      message.success(`清理完成：删除 ${data.data.verificationsDeleted} 条过期验证、${data.data.expiredTokensDeleted} 个过期 Token`);
    } else {
      message.error(data.error?.message || '清理失败');
    }
  } catch {
    message.error('清理请求失败');
  } finally {
    cleaning.value = false;
  }
}

onMounted(fetchStats);
</script>
