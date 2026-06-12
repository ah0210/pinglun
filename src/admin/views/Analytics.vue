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
          <n-data-table :columns="searchTrendColumns" :data="searchData.trend" size="small" :pagination="{ pageSize: 15 }" />
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
          <n-data-table :columns="socialTrendColumns" :data="socialData.trend" size="small" :pagination="{ pageSize: 15 }" />
        </n-tab-pane>
      </n-tabs>
    </n-card>
  </div>
</template>

<script lang="ts" setup>
import { h, onMounted, reactive, ref } from 'vue';
import { NButton, NCard, NDataTable, NGi, NGrid, NH2, NInput, NPagination, NSelect, NSpace, NTabPane, NTabs, NTag, NTooltip } from 'naive-ui';
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

// ===== SEO 多维度评估 =====

/** SEO 评估结果 */
interface SeoAssessment {
  score: number;        // 0-100
  level: 'success' | 'warning' | 'error' | 'info';
  label: string;        // 一句话总结
  tips: string[];       // 具体建议
}

/**
 * 多维度 SEO 评估
 * - 搜索占比（40%）：搜索流量占总流量比例，反映搜索引擎可见度
 * - 互动率（30%）：留言数/浏览量，反映内容价值
 * - 回访率（15%）：访客数/浏览量越低说明越多人只看一次
 * - 时效性（15%）：最近访问距今天数，反映内容是否过时
 */
function assessSeo(row: AnalyticsPage): SeoAssessment {
  const tips: string[] = [];
  let score = 0;

  // 维度1：搜索占比（0-40 分）
  const searchRatio = row.views > 0 ? row.searchViews / row.views : 0;
  if (searchRatio >= 0.5) {
    score += 40;
  } else if (searchRatio >= 0.3) {
    score += 30;
    tips.push('搜索占比尚可，可优化标题关键词');
  } else if (searchRatio >= 0.1) {
    score += 15;
    tips.push('搜索占比较低，检查标题是否匹配搜索意图');
  } else if (row.views >= 20) {
    score += 5;
    tips.push('搜索流量极少，标题可能缺少目标关键词');
  } else {
    score += 10; // 新页面，数据不足
  }

  // 维度2：互动率（0-30 分）
  const engagementRate = row.views > 0 ? row.messageCount / row.views : 0;
  if (engagementRate >= 0.05) {
    score += 30;
  } else if (engagementRate >= 0.02) {
    score += 20;
  } else if (engagementRate >= 0.005) {
    score += 10;
    tips.push('互动率偏低，可在文末增加互动引导');
  } else if (row.views >= 50) {
    score += 3;
    tips.push('互动率极低，内容可能缺乏讨论点');
  } else {
    score += 10;
  }

  // 维度3：回访率（0-15 分，visitors/views 越接近 1 越好 = 每次都是新访客 = 内容有吸引力）
  const revisitRatio = row.views > 0 ? row.visitors / row.views : 0;
  if (revisitRatio >= 0.7) {
    score += 15; // 大部分访客只看一次但有持续新访客
  } else if (revisitRatio >= 0.4) {
    score += 10;
  } else {
    score += 5;
    tips.push('回访率低，考虑增加系列内容引导回访');
  }

  // 维度4：时效性（0-15 分）
  if (row.lastViewAt) {
    const daysSinceLastView = Math.floor(
      (Date.now() - new Date(row.lastViewAt).getTime()) / 86400000
    );
    if (daysSinceLastView <= 3) {
      score += 15;
    } else if (daysSinceLastView <= 14) {
      score += 10;
    } else if (daysSinceLastView <= 30) {
      score += 5;
      tips.push('近 30 天访问减少，内容可能需要更新');
    } else {
      score += 0;
      tips.push('内容已过时（超 30 天无访问），考虑更新或重写');
    }
  } else {
    score += 5;
  }

  // 综合评级
  let level: SeoAssessment['level'];
  let label: string;
  if (score >= 70) {
    level = 'success';
    label = '优秀';
    if (tips.length === 0) tips.push('搜索可见度高，互动良好，继续保持');
  } else if (score >= 45) {
    level = 'info';
    label = '良好';
    if (tips.length === 0) tips.push('整体表现不错，仍有优化空间');
  } else if (score >= 25) {
    level = 'warning';
    label = '待优化';
    if (tips.length === 0) tips.push('建议提升搜索关键词覆盖和内容互动性');
  } else {
    level = 'error';
    label = '需改进';
    if (tips.length === 0) tips.push('搜索流量和互动均不足，需重点优化标题和内容');
  }

  // 额外建议
  if (row.views >= 100 && searchRatio < 0.05) {
    tips.push('高流量但搜索占比极低 → 可能是社交爆款，建议补充搜索关键词');
  }
  if (row.searchViews >= 50 && engagementRate < 0.005) {
    tips.push('搜索流量高但无互动 → 标题吸引点击但内容未满足需求');
  }
  if (row.messageCount > 0 && searchRatio < 0.1) {
    tips.push('有互动但搜索占比低 → 内容有价值，优化标题可获更多搜索流量');
  }

  return { score, level, label, tips: tips.slice(0, 3) };
}

/** 渲染 SEO 评分标签（带 tooltip 显示建议） */
function renderSeoTag(row: AnalyticsPage) {
  const assessment = assessSeo(row);
  const tag = h(NTag, {
    type: assessment.level,
    size: 'small',
  }, () => `${assessment.score}分 ${assessment.label}`);

  if (assessment.tips.length > 0) {
    return h(NTooltip, {}, {
      trigger: () => tag,
      default: () => h('div', assessment.tips.map(t => h('div', { style: 'margin-bottom: 4px;' }, `• ${t}`))),
    });
  }
  return tag;
}

// ===== 页面表现 =====

const pageColumns: DataTableColumns<AnalyticsPage> = [
  {
    title: '页面',
    key: 'pageTitle',
    ellipsis: { tooltip: true },
    render: (row) => row.pageTitle || row.pageId,
  },
  { title: 'PV', key: 'views', width: 70, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 70, sorter: 'default' },
  { title: '搜索 PV', key: 'searchViews', width: 85, sorter: 'default' },
  { title: '留言', key: 'messageCount', width: 65, sorter: 'default' },
  {
    title: '搜索占比',
    key: 'searchRatio',
    width: 90,
    sorter: (a, b) => {
      const ra = a.views > 0 ? a.searchViews / a.views : 0;
      const rb = b.views > 0 ? b.searchViews / b.views : 0;
      return ra - rb;
    },
    render: (row) => {
      const ratio = row.views > 0 ? row.searchViews / row.views : 0;
      return `${(ratio * 100).toFixed(1)}%`;
    },
  },
  {
    title: 'SEO',
    key: 'seo',
    width: 120,
    render: renderSeoTag,
  },
  {
    title: '打开',
    key: 'open',
    width: 60,
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
  {
    title: '占比',
    key: 'ratio',
    width: 80,
    render: (row, index) => {
      const total = searchData.engines.reduce((s, e) => s + e.views, 0);
      return total > 0 ? `${((row.views / total) * 100).toFixed(1)}%` : '-';
    },
  },
];

const searchLandingColumns: DataTableColumns<SearchLandingPage> = [
  {
    title: '着陆页',
    key: 'pageTitle',
    ellipsis: { tooltip: true },
    render: (row) => row.pageTitle || row.pageId,
  },
  { title: '搜索 PV', key: 'views', width: 90, sorter: 'default' },
  { title: '搜索 UV', key: 'visitors', width: 90, sorter: 'default' },
  {
    title: '搜索占比',
    key: 'searchRatio',
    width: 90,
    sorter: (a, b) => (a.totalViews || 0) - (b.totalViews || 0),
    render: (row) => {
      const ratio = row.totalViews > 0
        ? ((row.views / row.totalViews) * 100).toFixed(1) + '%'
        : '-';
      return ratio;
    },
  },
  {
    title: '主要引擎',
    key: 'topEngines',
    width: 140,
    render: (row) => {
      return row.topEngines?.length ? row.topEngines.slice(0, 3).join('、') : '-';
    },
  },
  {
    title: '打开',
    key: 'open',
    width: 60,
    render: (row) => row.pageUrl
      ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开')
      : '-',
  },
];

/** 渲染趋势环比变化 */
function renderChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? h('span', { style: 'color: #18a058;' }, '+∞') : '-';
  const change = ((current - previous) / previous) * 100;
  const color = change > 0 ? '#18a058' : change < 0 ? '#d03050' : '#999';
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  return h('span', { style: `color: ${color}; font-size: 12px;` }, `${arrow}${Math.abs(change).toFixed(1)}%`);
}

const searchTrendColumns: DataTableColumns<AnalyticsTrendRow> = [
  { title: '日期', key: 'date', width: 110 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  {
    title: 'PV 环比',
    key: 'viewsChange',
    width: 100,
    render: (row, index) => {
      if (index === 0) return '-';
      const prev = searchData.trend[index - 1];
      return renderChange(row.views, prev.views);
    },
  },
  {
    title: 'UV 环比',
    key: 'visitorsChange',
    width: 100,
    render: (row, index) => {
      if (index === 0) return '-';
      const prev = searchData.trend[index - 1];
      return renderChange(row.visitors, prev.visitors);
    },
  },
];

const countryColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '国家', key: 'country', width: 100 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  {
    title: '占比',
    key: 'ratio',
    width: 80,
    render: (row) => {
      const total = searchData.countries.reduce((s, c) => s + c.views, 0);
      return total > 0 ? `${((row.views / total) * 100).toFixed(1)}%` : '-';
    },
  },
];

// ===== 社交传播分析 =====

const socialSourceColumns: DataTableColumns<SocialSource> = [
  { title: '平台', key: 'platform', width: 120 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  {
    title: '占比',
    key: 'ratio',
    width: 80,
    render: (row) => {
      const total = socialData.sources.reduce((s, src) => s + src.views, 0);
      return total > 0 ? `${((row.views / total) * 100).toFixed(1)}%` : '-';
    },
  },
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
  { title: '社交流量', key: 'socialViews', width: 90, sorter: 'default' },
  { title: '社交访客', key: 'socialVisitors', width: 90, sorter: 'default' },
  {
    title: '打开',
    key: 'open',
    width: 60,
    render: (row) => row.pageUrl
      ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开')
      : '-',
  },
];

const socialTrendColumns: DataTableColumns<AnalyticsTrendRow> = [
  { title: '日期', key: 'date', width: 110 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  {
    title: 'PV 环比',
    key: 'viewsChange',
    width: 100,
    render: (row, index) => {
      if (index === 0) return '-';
      const prev = socialData.trend[index - 1];
      return renderChange(row.views, prev.views);
    },
  },
  {
    title: 'UV 环比',
    key: 'visitorsChange',
    width: 100,
    render: (row, index) => {
      if (index === 0) return '-';
      const prev = socialData.trend[index - 1];
      return renderChange(row.visitors, prev.visitors);
    },
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
