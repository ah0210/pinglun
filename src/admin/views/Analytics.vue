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

    <!-- 异常检测 -->
    <n-card v-if="anomalyData.anomalies.length > 0" style="margin-top: 16px;" title="异常告警">
      <n-space vertical>
        <n-alert
          v-for="(a, i) in anomalyData.anomalies"
          :key="i"
          :type="a.level === 'critical' ? 'error' : 'warning'"
          :title="`${metricLabel(a.metric)} 异常${a.direction === 'up' ? '上升' : '下降'} ${a.changePercent > 0 ? '+' : ''}${a.changePercent}%`"
        >
          <div>今日 <strong>{{ a.todayValue }}</strong> / 7日均值 <strong>{{ a.avgValue }}</strong></div>
          <div style="margin-top: 4px; color: #666;">可能原因：{{ a.possibleCause }}</div>
          <div style="color: #18a058;">建议：{{ a.suggestion }}</div>
        </n-alert>
      </n-space>
    </n-card>

    <!-- 转化漏斗 -->
    <n-card style="margin-top: 16px;" title="转化漏斗">
      <template #header-extra>
        <n-select v-model:value="funnelPageId" :options="funnelPageOptions" style="width: 240px" placeholder="选择页面" clearable @update:value="selectFunnelPage" />
      </template>
      <div v-if="currentFunnel" style="max-width: 600px;">
        <div v-for="(stage, i) in currentFunnel.stages" :key="i" style="margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="width: 80px; text-align: right; font-weight: 500;">{{ stage.name }}</span>
            <div style="flex: 1; background: #f5f5f5; border-radius: 4px; height: 28px; position: relative; overflow: hidden;">
              <div
                :style="{
                  width: funnelBarWidth(stage, currentFunnel.stages[0].value) + '%',
                  height: '100%',
                  background: funnelBarColor(i),
                  borderRadius: '4px',
                  transition: 'width 0.3s',
                }"
              />
              <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 13px; font-weight: 600;">
                {{ stage.value.toLocaleString() }}
              </span>
            </div>
            <span style="width: 70px; font-size: 13px; color: #999;">
              {{ i === 0 ? '100%' : (stage.rate * 100).toFixed(1) + '%' }}
            </span>
          </div>
          <div v-if="i > 0 && stage.dropoff > 0" style="margin-left: 92px; font-size: 12px; color: #d03050;">
            ↓ 流失 {{ (stage.dropoff * 100).toFixed(1) }}%
            <span v-if="stage.tip" style="color: #f0a020; margin-left: 8px;">{{ stage.tip }}</span>
          </div>
        </div>
        <div v-if="currentFunnel.suggestion" style="margin-top: 12px; padding: 8px 12px; background: #fff7e6; border-radius: 4px; font-size: 13px; color: #ad6800;">
          最大流失环节：{{ currentFunnel.biggestDrop }} — {{ currentFunnel.suggestion }}
        </div>
      </div>
      <n-empty v-else description="暂无漏斗数据（需页面 PV ≥ 10）" />
    </n-card>

    <!-- 页面表现 -->
    <n-card style="margin-top: 16px;" title="页面表现">
      <template #header-extra>
        <n-select
          v-model:value="pagePeriod"
          :options="pagePeriodOptions"
          style="width: 120px"
          @update:value="fetchPages(1)"
        />
      </template>
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

    <!-- 搜索关键词反查 -->
    <n-card style="margin-top: 16px;" title="搜索关键词反查">
      <template #header-extra>
        <n-select
          v-model:value="keywordDays"
          :options="daysOptions"
          style="width: 120px"
          @update:value="fetchKeywords"
        />
      </template>
      <n-tabs type="line" animated>
        <n-tab-pane name="keywords" tab="关键词排行">
          <n-space style="margin-bottom: 8px;">
            <n-tag type="info" size="small">提取率 {{ keywordData.summary.extractionRate }}</n-tag>
            <n-tag size="small">独立关键词 {{ keywordData.summary.uniqueKeywords }}</n-tag>
            <n-tag type="warning" size="small">Not Provided {{ keywordData.summary.notProvided }}</n-tag>
          </n-space>
          <n-data-table :columns="keywordColumns" :data="keywordData.keywords" size="small" :pagination="{ pageSize: 15 }" />
        </n-tab-pane>
        <n-tab-pane name="keywordPages" tab="关键词→页面">
          <n-data-table :columns="keywordPageColumns" :data="keywordData.topKeywordsWithPages" size="small" :pagination="{ pageSize: 10 }" />
        </n-tab-pane>
        <n-tab-pane name="engineStats" tab="引擎关键词覆盖">
          <n-data-table :columns="engineKeywordColumns" :data="keywordData.engineStats" size="small" />
        </n-tab-pane>
      </n-tabs>
    </n-card>

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
import { computed, h, onMounted, reactive, ref } from 'vue';
import { NAlert, NButton, NCard, NDataTable, NEmpty, NGi, NGrid, NH2, NInput, NPagination, NSelect, NSpace, NTabPane, NTabs, NTag, NTooltip } from 'naive-ui';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import StatsCard from '../components/StatsCard.vue';
import { useAuthStore } from '../stores/auth';
import type {
  AnalyticsBreakdownRow, AnalyticsPage, AnalyticsSummary, AnalyticsTrendRow,
  AnomalyData, AnomalyEvent, FunnelData, FunnelStage, PageFunnel,
  KeywordData, KeywordRow,
  PaginatedResponse, SearchAnalytics, SearchLandingPage,
  SocialAnalytics, SocialSource, SocialPage,
} from '../../shared/types';

const authStore = useAuthStore();
const loadingPages = ref(false);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const pages = ref<AnalyticsPage[]>([]);
const channels = ref<AnalyticsBreakdownRow[]>([]);
const referrers = ref<AnalyticsBreakdownRow[]>([]);

/** 页面表现时间段 */
const pagePeriod = ref('7d');
const pagePeriodOptions: SelectOption[] = [
  { label: '今日', value: 'today' },
  { label: '昨日', value: 'yesterday' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
  { label: '累计', value: 'all' },
];

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

/** 异常检测 */
const anomalyData = reactive<AnomalyData>({
  anomalies: [],
  dataPoints: 0,
  today: { date: '', pv: 0, uv: 0, searchPv: 0, messages: 0 },
  baseline: { avgPv: 0, avgUv: 0 },
});

/** 转化漏斗 */
const funnelData = reactive<FunnelData>({
  overall: { stages: [] },
  pages: [],
});
const funnelPageId = ref<string | null>(null);
const currentFunnel = computed<PageFunnel | null>(() => {
  if (!funnelPageId.value) return funnelData.pages.length > 0 ? funnelData.pages[0] : null;
  return funnelData.pages.find(p => p.pageId === funnelPageId.value) || funnelData.pages[0] || null;
});
const funnelPageOptions = computed<SelectOption[]>(() => [
  { label: '全站汇总', value: '__overall__' },
  ...funnelData.pages.map(p => ({ label: p.pageTitle || p.pageId, value: p.pageId })),
]);

/** 搜索关键词反查 */
const keywordDays = ref(30);
const keywordData = reactive<KeywordData>({
  keywords: [],
  topKeywordsWithPages: [],
  engineStats: [],
  summary: { totalSearchEvents: 0, extractedKeywords: 0, notProvided: 0, extractionRate: '0%', uniqueKeywords: 0 },
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

// ===== 异常检测 =====

/** 指标名称映射 */
function metricLabel(metric: string): string {
  const map: Record<string, string> = { pv: '页面浏览量', uv: '独立访客', searchPv: '搜索流量', messages: '留言数' };
  return map[metric] || metric;
}

// ===== 转化漏斗 =====

/** 漏斗条宽度（百分比） */
function funnelBarWidth(stage: FunnelStage, maxVal: number): number {
  if (maxVal === 0) return 0;
  return Math.max(Math.round((stage.value / maxVal) * 100), 2);
}

/** 漏斗条颜色 */
function funnelBarColor(index: number): string {
  const colors = ['#18a058', '#2080f0', '#f0a020', '#d03050'];
  return colors[index] || '#999';
}

/** 选择漏斗页面 */
function selectFunnelPage(val: string | null) {
  if (val === '__overall__') funnelPageId.value = null;
  else funnelPageId.value = val;
}

// ===== SEO 多维度评估 =====

interface SeoAssessment {
  score: number;
  level: 'success' | 'warning' | 'error' | 'info';
  label: string;
  tips: string[];
}

/**
 * 多维度 SEO 评估
 * - 搜索占比（40%）：搜索流量占总流量比例
 * - 互动率（30%）：留言数/浏览量
 * - 回访率（15%）：访客数/浏览量
 * - 时效性（15%）：最近访问距今天数
 */
function assessSeo(row: AnalyticsPage): SeoAssessment {
  const tips: string[] = [];
  let score = 0;

  const searchRatio = row.views > 0 ? row.searchViews / row.views : 0;
  if (searchRatio >= 0.5) score += 40;
  else if (searchRatio >= 0.3) { score += 30; tips.push('搜索占比尚可，可优化标题关键词'); }
  else if (searchRatio >= 0.1) { score += 15; tips.push('搜索占比较低，检查标题是否匹配搜索意图'); }
  else if (row.views >= 20) { score += 5; tips.push('搜索流量极少，标题可能缺少目标关键词'); }
  else score += 10;

  const engagementRate = row.views > 0 ? row.messageCount / row.views : 0;
  if (engagementRate >= 0.05) score += 30;
  else if (engagementRate >= 0.02) score += 20;
  else if (engagementRate >= 0.005) { score += 10; tips.push('互动率偏低，可在文末增加互动引导'); }
  else if (row.views >= 50) { score += 3; tips.push('互动率极低，内容可能缺乏讨论点'); }
  else score += 10;

  const revisitRatio = row.views > 0 ? row.visitors / row.views : 0;
  if (revisitRatio >= 0.7) score += 15;
  else if (revisitRatio >= 0.4) score += 10;
  else { score += 5; tips.push('回访率低，考虑增加系列内容引导回访'); }

  if (row.lastViewAt) {
    const daysSince = Math.floor((Date.now() - new Date(row.lastViewAt).getTime()) / 86400000);
    if (daysSince <= 3) score += 15;
    else if (daysSince <= 14) score += 10;
    else if (daysSince <= 30) { score += 5; tips.push('近 30 天访问减少，内容可能需要更新'); }
    else tips.push('内容已过时（超 30 天无访问），考虑更新或重写');
  } else score += 5;

  let level: SeoAssessment['level'];
  let label: string;
  if (score >= 70) { level = 'success'; label = '优秀'; if (!tips.length) tips.push('搜索可见度高，互动良好，继续保持'); }
  else if (score >= 45) { level = 'info'; label = '良好'; if (!tips.length) tips.push('整体表现不错，仍有优化空间'); }
  else if (score >= 25) { level = 'warning'; label = '待优化'; if (!tips.length) tips.push('建议提升搜索关键词覆盖和内容互动性'); }
  else { level = 'error'; label = '需改进'; if (!tips.length) tips.push('搜索流量和互动均不足，需重点优化标题和内容'); }

  if (row.views >= 100 && searchRatio < 0.05) tips.push('高流量但搜索占比极低 → 可能是社交爆款，建议补充搜索关键词');
  if (row.searchViews >= 50 && engagementRate < 0.005) tips.push('搜索流量高但无互动 → 标题吸引点击但内容未满足需求');
  if (row.messageCount > 0 && searchRatio < 0.1) tips.push('有互动但搜索占比低 → 内容有价值，优化标题可获更多搜索流量');

  return { score, level, label, tips: tips.slice(0, 3) };
}

function renderSeoTag(row: AnalyticsPage) {
  const a = assessSeo(row);
  const tag = h(NTag, { type: a.level, size: 'small' }, () => `${a.score}分 ${a.label}`);
  if (a.tips.length > 0) {
    return h(NTooltip, {}, {
      trigger: () => tag,
      default: () => h('div', a.tips.map(t => h('div', { style: 'margin-bottom: 4px;' }, `• ${t}`))),
    });
  }
  return tag;
}

// ===== 表格列定义 =====

const pageColumns: DataTableColumns<AnalyticsPage> = [
  { title: '页面', key: 'pageTitle', ellipsis: { tooltip: true }, render: (row) => row.pageTitle || row.pageId },
  { title: 'PV', key: 'views', width: 70, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 70, sorter: 'default' },
  { title: '会话', key: 'sessions', width: 70, sorter: 'default' },
  { title: '搜索 PV', key: 'searchViews', width: 85, sorter: 'default' },
  { title: '留言', key: 'messageCount', width: 65, sorter: 'default' },
  { title: '搜索占比', key: 'searchRatio', width: 90, sorter: (a, b) => (a.views > 0 ? a.searchViews / a.views : 0) - (b.views > 0 ? b.searchViews / b.views : 0), render: (row) => `${((row.views > 0 ? row.searchViews / row.views : 0) * 100).toFixed(1)}%` },
  { title: 'SEO', key: 'seo', width: 120, render: renderSeoTag },
  { title: '打开', key: 'open', width: 60, render: (row) => row.pageUrl ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开') : '-' },
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

const searchEngineColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '搜索引擎', key: 'referrerDomain', ellipsis: { tooltip: true } },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  { title: '占比', key: 'ratio', width: 80, render: (row) => { const t = searchData.engines.reduce((s, e) => s + e.views, 0); return t > 0 ? `${((row.views / t) * 100).toFixed(1)}%` : '-'; } },
];

const searchLandingColumns: DataTableColumns<SearchLandingPage> = [
  { title: '着陆页', key: 'pageTitle', ellipsis: { tooltip: true }, render: (row) => row.pageTitle || row.pageId },
  { title: '搜索 PV', key: 'views', width: 90, sorter: 'default' },
  { title: '搜索 UV', key: 'visitors', width: 90, sorter: 'default' },
  { title: '搜索占比', key: 'searchRatio', width: 90, sorter: (a, b) => a.totalViews - b.totalViews, render: (row) => row.totalViews > 0 ? `${((row.views / row.totalViews) * 100).toFixed(1)}%` : '-' },
  { title: '主要引擎', key: 'topEngines', width: 140, render: (row) => row.topEngines?.length ? row.topEngines.slice(0, 3).join('、') : '-' },
  { title: '打开', key: 'open', width: 60, render: (row) => row.pageUrl ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开') : '-' },
];

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
  { title: 'PV 环比', key: 'viewsChange', width: 100, render: (row, index) => index === 0 ? '-' : renderChange(row.views, searchData.trend[index - 1].views) },
  { title: 'UV 环比', key: 'visitorsChange', width: 100, render: (row, index) => index === 0 ? '-' : renderChange(row.visitors, searchData.trend[index - 1].visitors) },
];

const countryColumns: DataTableColumns<AnalyticsBreakdownRow> = [
  { title: '国家', key: 'country', width: 100 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  { title: '占比', key: 'ratio', width: 80, render: (row) => { const t = searchData.countries.reduce((s, c) => s + c.views, 0); return t > 0 ? `${((row.views / t) * 100).toFixed(1)}%` : '-'; } },
];

const socialSourceColumns: DataTableColumns<SocialSource> = [
  { title: '平台', key: 'platform', width: 120 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  { title: '占比', key: 'ratio', width: 80, render: (row) => { const t = socialData.sources.reduce((s, src) => s + src.views, 0); return t > 0 ? `${((row.views / t) * 100).toFixed(1)}%` : '-'; } },
  { title: '来源域名', key: 'domains', render: (row) => row.domains.join(', '), ellipsis: { tooltip: true } },
];

const socialPageColumns: DataTableColumns<SocialPage> = [
  { title: '页面', key: 'pageTitle', ellipsis: { tooltip: true }, render: (row) => row.pageTitle || row.pageId },
  { title: '社交流量', key: 'socialViews', width: 90, sorter: 'default' },
  { title: '社交访客', key: 'socialVisitors', width: 90, sorter: 'default' },
  { title: '打开', key: 'open', width: 60, render: (row) => row.pageUrl ? h('a', { href: row.pageUrl, target: '_blank', rel: 'noopener noreferrer', style: 'color: #667eea; text-decoration: none;' }, '打开') : '-' },
];

const socialTrendColumns: DataTableColumns<AnalyticsTrendRow> = [
  { title: '日期', key: 'date', width: 110 },
  { title: 'PV', key: 'views', width: 80, sorter: 'default' },
  { title: 'UV', key: 'visitors', width: 80, sorter: 'default' },
  { title: 'PV 环比', key: 'viewsChange', width: 100, render: (row, index) => index === 0 ? '-' : renderChange(row.views, socialData.trend[index - 1].views) },
  { title: 'UV 环比', key: 'visitorsChange', width: 100, render: (row, index) => index === 0 ? '-' : renderChange(row.visitors, socialData.trend[index - 1].visitors) },
];

// ===== 关键词反查 =====

const keywordColumns: DataTableColumns<KeywordRow> = [
  { title: '关键词', key: 'keyword', ellipsis: { tooltip: true } },
  { title: '搜索 PV', key: 'views', width: 90, sorter: 'default' },
  { title: '搜索 UV', key: 'visitors', width: 90, sorter: 'default' },
  { title: '落地页数', key: 'pages', width: 90, sorter: 'default' },
];

const keywordPageColumns: DataTableColumns<KeywordRow & { topPages: any[] }> = [
  { title: '关键词', key: 'keyword', width: 160, ellipsis: { tooltip: true } },
  { title: '搜索 PV', key: 'views', width: 90, sorter: 'default' },
  {
    title: '主要落地页',
    key: 'topPages',
    render: (row) => {
      if (!row.topPages?.length) return '-';
      return h('div', row.topPages.slice(0, 3).map((p: any) =>
        h('div', { style: 'font-size: 12px; margin-bottom: 2px;' }, `${p.pageTitle || p.pageId} (${p.views}PV)`)
      ));
    },
  },
];

const engineKeywordColumns: DataTableColumns<{ engine: string; totalViews: number; withKeywordViews: number; notProvidedRate: string }> = [
  { title: '搜索引擎', key: 'engine', width: 140 },
  { title: '总搜索 PV', key: 'totalViews', width: 100, sorter: 'default' },
  { title: '有关键词 PV', key: 'withKeywordViews', width: 110, sorter: 'default' },
  { title: 'Not Provided', key: 'notProvidedRate', width: 110 },
];

// ===== 工具函数 =====

function channelLabel(channel: string): string {
  const map: Record<string, string> = { direct: '直接访问', internal: '站内', search: '搜索', referral: '外链', social: '社交' };
  return map[channel] || channel || '-';
}

// ===== 数据获取 =====

async function fetchSummary() {
  const resp = await fetch('/api/v1/admin/analytics/summary', { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) Object.assign(summary, data.data);
}

async function fetchPages(p = 1) {
  loadingPages.value = true;
  page.value = p;
  try {
    const params = new URLSearchParams({ page: String(p), limit: '20', period: pagePeriod.value });
    if (search.value) params.set('search', search.value);
    const resp = await fetch(`/api/v1/admin/analytics/pages?${params}`, { headers: headers(), credentials: 'include' });
    const data = await resp.json() as { success: boolean; data?: PaginatedResponse<AnalyticsPage> };
    if (data.success && data.data) { pages.value = data.data.items; totalPages.value = data.data.totalPages; }
  } finally { loadingPages.value = false; }
}

async function fetchBreakdowns() {
  const [channelsResp, referrersResp] = await Promise.all([
    fetch('/api/v1/admin/analytics/channels', { headers: headers(), credentials: 'include' }),
    fetch('/api/v1/admin/analytics/referrers', { headers: headers(), credentials: 'include' }),
  ]);
  const [channelsData, referrersData] = await Promise.all([channelsResp.json(), referrersResp.json()]);
  if (channelsData.success) channels.value = channelsData.data || [];
  if (referrersData.success) referrers.value = referrersData.data || [];
}

async function fetchSearchData() {
  const resp = await fetch(`/api/v1/admin/analytics/search?days=${searchDays.value}`, { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) {
    searchData.engines = data.data.engines || [];
    searchData.pages = data.data.pages || [];
    searchData.trend = data.data.trend || [];
    searchData.countries = data.data.countries || [];
  }
}

async function fetchSocialData() {
  const resp = await fetch(`/api/v1/admin/analytics/social?days=${socialDays.value}`, { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) {
    socialData.sources = data.data.sources || [];
    socialData.pages = data.data.pages || [];
    socialData.trend = data.data.trend || [];
  }
}

/** 获取异常检测数据 */
async function fetchAnomalies() {
  const resp = await fetch('/api/v1/admin/analytics/anomalies', { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) Object.assign(anomalyData, data.data);
}

/** 获取转化漏斗数据 */
async function fetchFunnel() {
  const resp = await fetch('/api/v1/admin/analytics/funnel?limit=20', { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) Object.assign(funnelData, data.data);
}

/** 获取搜索关键词反查数据 */
async function fetchKeywords() {
  const resp = await fetch(`/api/v1/admin/analytics/keywords?days=${keywordDays.value}`, { headers: headers(), credentials: 'include' });
  const data = await resp.json();
  if (data.success && data.data) Object.assign(keywordData, data.data);
}

onMounted(() => {
  fetchSummary();
  fetchPages();
  fetchBreakdowns();
  fetchSearchData();
  fetchSocialData();
  fetchAnomalies();
  fetchFunnel();
  fetchKeywords();
});
</script>
