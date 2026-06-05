<!-- src/admin/components/AdminLayout.vue — 管理后台布局 -->
<template>
  <n-message-provider>
    <n-dialog-provider>
      <n-layout has-sider style="height: 100vh">
        <n-layout-sider bordered :width="220" :collapsed-width="64" collapse-mode="width" :collapsed="collapsed" show-trigger @collapse="collapsed = true" @expand="collapsed = false">
          <div style="padding: 16px; font-weight: 600; font-size: 16px; text-align: center; border-bottom: 1px solid var(--n-border-color)">
            <span v-if="!collapsed">自游人留言板</span>
            <span v-else>留言板</span>
          </div>
          <n-menu :options="menuOptions" :value="currentRoute" @update:value="handleMenuSelect" :collapsed="collapsed" :collapsed-width="64" :collapsed-icon-size="22" />
        </n-layout-sider>
        <n-layout>
          <n-layout-header bordered style="height: 50px; display: flex; align-items: center; justify-content: flex-end; padding: 0 20px;">
            <n-space>
              <span style="font-size: 13px; color: #999">{{ authStore.user?.displayName }}</span>
              <n-button text size="small" @click="handleLogout">退出</n-button>
            </n-space>
          </n-layout-header>
          <n-layout-content style="padding: 20px; background: #f5f5f5; min-height: calc(100vh - 50px);">
            <router-view />
          </n-layout-content>
        </n-layout>
      </n-layout>
    </n-dialog-provider>
  </n-message-provider>
</template>

<script lang="ts" setup>
import { ref, computed, h, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu, NButton, NSpace, NMessageProvider, NDialogProvider } from 'naive-ui';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const collapsed = ref(false);

// 移动端默认折叠侧边栏
function checkMobile() {
  collapsed.value = window.innerWidth <= 768;
}
onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});
onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});

const currentRoute = computed(() => route.name as string);

const menuOptions = [
  { label: '数据概览', key: 'Dashboard', icon: () => h('span', null, '📊') },
  { label: '流量分析', key: 'Analytics', icon: () => h('span', null, '📈') },
  { label: '留言管理', key: 'Messages', icon: () => h('span', null, '💬') },
  { label: '用户管理', key: 'Users', icon: () => h('span', null, '👥') },
  { label: '系统配置', key: 'Config', icon: () => h('span', null, '⚙️') },
  { label: '操作日志', key: 'Logs', icon: () => h('span', null, '📋') },
];

function handleMenuSelect(key: string) {
  router.push({ name: key });
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}
</script>
