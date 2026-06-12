<!-- src/admin/views/Analytics.vue — 流量分析 -->
<template>
  <div>
    <n-h2>流量分析</n-h2>

    <!-- 概览卡片 -->
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

    <!-- 页面表现 -->
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

    <!-- 渠道 + 来源域名 -->
    <n-grid :cols="2" :x-gap="12" :y-gap="12" responsive="screen" item-responsive style="margin-top: 16px;">
      <n-gi span="0:2 900:1">
        <n-card title="渠道分布">
          <n-data-table :columns="channelColumns" :data="channels" size="small" />
        </n-card>
      </n-gi>
      <n-gi span="0:2 900:1">
        <n-card title="来源域名">
          <n-data-table :columns="referrerColumns" :data="referrers" size="small" />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 搜索来源分析 -->
    <n-card style="margin-top: 16px;" title="搜索来源分析">
      <template #header-extra>
        <n-select
          v-model:value="searchDays"
          :options="daysOptions"
          style="width: 120px"
          @update:value="fetchSearchData"
        />
      </template>
      <n-tabs type="line" animated>
        <n-tab-pane name="engines" tab="搜索引擎">
          <n-data-table :columns="searchEngineColumns" :data="searchData.engines" size="small" />
        </n-tab-pane>
        <n-tab-pane name="landing" tab="搜索着陆页">
          <n-data-table :columns="searchLandingColumns" :data="searchData.pages" size="small" />
        </n-tab-pane>
        <n-tab-pane name="trend" tab="搜索趋势">
          <n-data-table :columns="trendColumns" :data="searchData.trend" size="small" :pagination="{ pageSize: 15 }" />
        </n-tab-pane>
        <n-tab-pane name="countries" tab="国家分布">
          <n-data-table :columns="countryColumns" :data="searchData.countries" size="small" />
        </n-tab-pane>
      </n-tabs>
    </n-card>

    <!-- 社交传播分析 -->
    <n-card style="margin-top: 16px;" title="社交传播分析">
      <template #header-extra>
        <n-select
          v-model:value="socialDays"
          :options="daysOptions"
          style="width: 120px"
          @update:value="fetchSocialData"
        />
      </template>
      <n-tabs type="line" animated>
        <n-tab-pane name="sources" tab="社交平台">
          <n-data-table :columns="socialSourceColumns" :data="socialData.sources" size="small" />
        </n-tab-pane>
        <n-tab-pane name="pages" tab="社交热门页">
          <n-data-table :columns="socialPageColumns" :data="socialData.pages" size="small" />
        </n-tab-pane>
        <n-tab-pane name="trend" tab="社交流量趋势">
          <n-data-table :columns="trendColumns" :data="socialData.trend" size="small" :pagination="{ pageSize: 15 }" />
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { h, onMounted, reactive, ref } from 'vue';
import { NButton, NCard, NDataTable, NGi, NGrid, NH2, NInput, NPagination, NSelect, NSpace, NTabPane, NTabs, NTag } from 'naive-ui';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import StatsCard from '../components/StatsCard.vue';
import { useAuthStore } from '../stores/auth';
import type {
  AnalyticsBreakdownRow, AnalyticsPage, AnalyticsSummary, PaginatedResponse,
  SearchAnalytics, SearchLandingPage, SocialAnalytics, SocialSource, SocialPage, AnalyticsTrendRow,
} from '../../shared/types';

const authStore = useAuthStore();
const loadingPages = ref(false);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const pages = ref<AnalyticsPage[]>([]);
const channels = ref<AnalyticsBreakdownRow[]>([]);
const referrers = ref<AnalyticsBreakdownRow[]>([]);

/** 搜索来源分析 */
const searchDays = ref(30);
const searchData = reactive<SearchAnalytics>({
  engines: [],
  pages: [],
  trend: [],
  countries: [],
});

/** 社交传播分析 */
const socialDays = ref(30);
const socialData = reactive<SocialAnalytics>({
  sources: [],
  pages: [],
  trend: [],
});

const summary = reactive<AnalyticsSummary>({
  today: { views: 0, visitors: 0, sessions: 0 },
  yesterday: { views: 0, visitors: 0, sessions: 0 },
  windows: { last7Views: 0, last30Views: 0, previous7Views: 0 },
  topPages: [],
});

/** 时间范围选项 */
const daysOptions: SelectOption[] = [
  { label: '近 7 天', value: 7 },
  { label: '近 14 天', value: 14 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 },
  { label: '近 180 天', value: 180 },
];

const headers = () => ({
  Authorization: `Bearer ${authStore.token}`,
});

// ===== 页面表现 =====

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

// ===== 渠道 + 来源 =====

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

// ===== 搜索来源分析 =====

const searchEngineColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '搜索引擎', key: 'referrerDomain', ellipsis: { tooltip: true } },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
];

const searchLandingColumns: DataTableColumns<SearchLandingPage> = [
  {
    title: '着陆页',
    key: 'pageTitle',
    ellipsis: { tooltip: true },
    render: (row) => row.pageTitle || row.pageId,
  },
  { title: '搜索 PV', key: 'views', width: 100, sorter: 'default' },
  { title: '搜索 UV', key: 'visitors', width: 100, sorter: 'default' },
  {
    title: '打开',
    key: 'open',
    width: 70,
    render: (row) => row.pageUrl
      ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开')
      : '-',
  },
];

const trendColumns: DataTableColumns<AnalyticsTrendRow> = [
  { title: '日期', key: 'date', width: 120 },
  { title: 'PV', key: 'views', width: 100, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 100, sorter: 'default' },
];

const countryColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '国家', key: 'country', width: 100 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
];

// ===== 社交传播分析 =====

const socialSourceColumns: DataTableColumns<SocialSource> = [
  { title: '平台', key: 'platform', width: 120 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  {
    title: '来源域名',
    key: 'domains',
    render: (row) => row.domains.join(', '),
    ellipsis: { tooltip: true },
  },
];

const socialPageColumns: DataTableColumns<SocialPage> = [
  {
    title: '页面',
    key: 'pageTitle',
    ellipsis: { tooltip: true },
    render: (row) => row.pageTitle || row.pageId,
  },
  { title: '社交流量', key: 'socialViews', width: 100, sorter: 'default' },
  { title: '社交访客', key: 'socialVisitors', width: 100, sorter: 'default' },
  {
    title: '打开',
    key: 'open',
    width: 70,
    render: (row) => row.pageUrl
      ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开')
      : '-',
  },
];

// ===== 工具函数 =====

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

// ===== 数据获取 =====

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
  const [channelsResp, referrersResp] = await Promise.all([
    fetch('/api/v1/admin/analytics/channels', { headers: headers(), credentials: 'include' }),
    fetch('/api/v1/admin/analytics/referrers', { headers: headers(), credentials: 'include' }),
  ]);
  const [channelsData, referrersData] = await Promise.all([
    channelsResp.json(),
    referrersResp.json(),
  ]);
  if (channelsData.success) channels.value = channelsData.data || [];
  if (referrersData.success) referrers.value = referrersData.data || [];
}

/** 获取搜索来源分析数据 */
async function fetchSearchData() {
  const resp = await fetch(`/api/v1/admin/analytics/search?days=${searchDays.value}`, {
    headers: headers(),
    credentials: 'include',
  });
  const data = await resp.json();
  if (data.success && data.data) {
    searchData.engines = data.data.engines || [];
    searchData.pages = data.data.pages || [];
    searchData.trend = data.data.trend || [];
    searchData.countries = data.data.countries || [];
  }
}

/** 获取社交传播分析数据 */
async function fetchSocialData() {
  const resp = await fetch(`/api/v1/admin/analytics/social?days=${socialDays.value}`, {
    headers: headers(),
    credentials: 'include',
  });
  const data = await resp.json();
  if (data.success && data.data) {
    socialData.sources = data.data.sources || [];
    socialData.pages = data.data.pages || [];
    socialData.trend = data.data.trend || [];
  }
}

onMounted(() => {
  fetchSummary();
  fetchPages();
  fetchBreakdowns();
  fetchSearchData();
  fetchSocialData();
});
</script>
