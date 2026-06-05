<!-- src/admin/views/Analytics.vue — 流量分析 -->
<template>
  <div>
    <n-h2>流量分析</n-h2>

    <n-grid :cols="4" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="今日 PV" :value="summary.today.views" prefix="PV" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="今日 UV" :value="summary.today.visitors" prefix="UV" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="近 7 天 PV" :value="summary.windows.last7Views" prefix="7D" />
      </n-gi>
      <n-gi span="0:4 640:2 1024:1">
        <StatsCard label="近 30 天 PV" :value="summary.windows.last30Views" prefix="30D" />
      </n-gi>
    </n-grid>

    <n-card style="margin-top: 16px;" title="页面表现">
      <n-space style="margin-bottom: 12px;">
        <n-input v-model:value="search" placeholder="搜索页面标题 / ID / URL" clearable style="width: 260px" @keyup.enter="fetchPages(1)" />
        <n-button type="primary" @click="fetchPages(1)">搜索</n-button>
      </n-space>
      <n-data-table :columns="pageColumns" :data="pages" :loading="loadingPages" />
      <n-pagination
        style="margin-top: 16px; justify-content: center;"
        :page="page"
        :page-count="totalPages"
        @update:page="fetchPages"
      />
    </n-card>

    <n-grid :cols="3" :x-gap="12" :y-gap="12" responsive="screen" item-responsive style="margin-top: 16px;">
      <n-gi span="0:3 900:1">
        <n-card title="渠道分布">
          <n-data-table :columns="channelColumns" :data="channels" size="small" />
        </n-card>
      </n-gi>
      <n-gi span="0:3 900:1">
        <n-card title="来源域名">
          <n-data-table :columns="referrerColumns" :data="referrers" size="small" />
        </n-card>
      </n-gi>
      <n-gi span="0:3 900:1">
        <n-card title="搜索入口">
          <n-data-table :columns="searchColumns" :data="searchEngines" size="small" />
        </n-card>
      </n-gi>
    </n-grid>
  </div>
</template>

<script lang="ts" setup>
import { h, onMounted, reactive, ref } from 'vue';
import { NButton, NCard, NDataTable, NGi, NGrid, NH2, NInput, NPagination, NSpace, NTag } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import StatsCard from '../components/StatsCard.vue';
import { useAuthStore } from '../stores/auth';
import type { AnalyticsBreakdownRow, AnalyticsPage, AnalyticsSummary, PaginatedResponse } from '../../shared/types';

const authStore = useAuthStore();
const loadingPages = ref(false);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const pages = ref<AnalyticsPage[]>([]);
const channels = ref<AnalyticsBreakdownRow[]>([]);
const referrers = ref<AnalyticsBreakdownRow[]>([]);
const searchEngines = ref<AnalyticsBreakdownRow[]>([]);

const summary = reactive<AnalyticsSummary>({
  today: { views: 0, visitors: 0, sessions: 0 },
  yesterday: { views: 0, visitors: 0, sessions: 0 },
  windows: { last7Views: 0, last30Views: 0, previous7Views: 0 },
  topPages: [],
});

const headers = () => ({
  Authorization: `Bearer ${authStore.token}`,
});

const pageColumns: DataTableColumns<AnalyticsPage> = [
  {
    title: '页面',
    key: 'pageTitle',
    ellipsis: { tooltip: true },
    render: (row) => row.pageTitle || row.pageId,
  },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  { title: '会话', key: 'sessions', width: 80, sorter: 'default' },
  { title: '搜索 PV', key: 'searchViews', width: 100, sorter: 'default' },
  { title: '留言', key: 'messageCount', width: 80, sorter: 'default' },
  {
    title: 'SEO',
    key: 'seo',
    width: 110,
    render: (row) => {
      const ratio = row.views > 0 ? row.searchViews / row.views : 0;
      if (ratio >= 0.5) return h(NTag, { type: 'success', size: 'small' }, () => '搜索有效');
      if (row.views >= 20 && ratio < 0.1) return h(NTag, { type: 'warning', size: 'small' }, () => '需优化');
      return h(NTag, { size: 'small' }, () => '观察');
    },
  },
  {
    title: '打开',
    key: 'open',
    width: 70,
    render: (row) => row.pageUrl
      ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开')
      : '-',
  },
];

const channelColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '渠道', key: 'channel', render: (row) => channelLabel(row.channel || '') },
  { title: 'PV', key: 'views', width: 80 },
  { title: 'UV', key: 'visitors', width: 80 },
];

const referrerColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '域名', key: 'referrerDomain', ellipsis: { tooltip: true } },
  { title: 'PV', key: 'views', width: 80 },
  { title: 'UV', key: 'visitors', width: 80 },
];

const searchColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '搜索域名', key: 'referrerDomain', ellipsis: { tooltip: true } },
  { title: 'PV', key: 'views', width: 80 },
  { title: 'UV', key: 'visitors', width: 80 },
];

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    direct: '直接访问',
    internal: '站内',
    search: '搜索',
    referral: '外链',
    social: '社交',
  };
  return map[channel] || channel || '-';
}

async function fetchSummary() {
  const resp = await fetch('/api/v1/admin/analytics/summary', {
    headers: headers(),
    credentials: 'include',
  });
  const data = await resp.json();
  if (data.success && data.data) Object.assign(summary, data.data);
}

async function fetchPages(p = 1) {
  loadingPages.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (search.value) params.set('search', search.value);
    const resp = await fetch(`/api/v1/admin/analytics/pages?${params}`, {
      headers: headers(),
      credentials: 'include',
    });
    const data = await resp.json() as { success: boolean; data?: PaginatedResponse<AnalyticsPage> };
    if (data.success && data.data) {
      pages.value = data.data.items;
      totalPages.value = data.data.totalPages;
    }
  } finally {
    loadingPages.value = false;
  }
}

async function fetchBreakdowns() {
  const [channelsResp, referrersResp, searchResp] = await Promise.all([
    fetch('/api/v1/admin/analytics/channels', { headers: headers(), credentials: 'include' }),
    fetch('/api/v1/admin/analytics/referrers', { headers: headers(), credentials: 'include' }),
    fetch('/api/v1/admin/analytics/search', { headers: headers(), credentials: 'include' }),
  ]);
  const [channelsData, referrersData, searchData] = await Promise.all([
    channelsResp.json(),
    referrersResp.json(),
    searchResp.json(),
  ]);
  if (channelsData.success) channels.value = channelsData.data || [];
  if (referrersData.success) referrers.value = referrersData.data || [];
  if (searchData.success) searchEngines.value = searchData.data?.engines || [];
}

onMounted(() => {
  fetchSummary();
  fetchPages();
  fetchBreakdowns();
});
</script>

