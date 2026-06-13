// functions/api/v1/admin/analytics/pages.ts — 页面表现列表（支持时间段筛选）
import { apiHandler } from '../../../../../lib/middleware';
import { paginatedResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

/** 允许的排序字段白名单（防 SQL 注入） */
const SORT_COLUMNS_TOTALS: Record<string, string> = {
  views: 'views',
  visitors: 'visitors',
  sessions: 'sessions',
  searchViews: 'search_views',
  messageCount: 'message_count',
  updatedAt: 'updated_at',
};

const SORT_COLUMNS_DAILY: Record<string, string> = {
  views: 'views',
  visitors: 'visitors',
  sessions: 'sessions',
  searchViews: 'search_views',
  messageCount: 'message_count',
};

/**
 * 页面表现列表
 * - period=all（默认）：查 analytics_page_totals 累计数据
 * - period=today/yesterday/7d/30d：查 analytics_page_daily 按时间段聚合
 */
export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
  const search = (url.searchParams.get('search') || '').trim();
  const period = url.searchParams.get('period') || 'all';
  const offset = (page - 1) * limit;

  // 根据时间段选择查询方式
  if (period === 'all') {
    // 累计数据：从 page_totals 查询
    return await queryTotals(env, { page, limit, search, offset });
  } else {
    // 按时间段：从 page_daily 聚合查询
    return await queryDaily(env, { page, limit, search, period, offset });
  }
}, { requireAdmin: true });

/** 查询累计数据 */
async function queryTotals(env: any, opts: { page: number; limit: number; search: string; offset: number }) {
  const { page, limit, search, offset } = opts;
  const sort = SORT_COLUMNS_TOTALS[search] || 'views';

  let where = '';
  const binds: unknown[] = [];
  if (search) {
    where = 'WHERE page_id LIKE ? OR page_title LIKE ? OR page_url LIKE ?';
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }

  const total = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM analytics_page_totals ${where}`
  ).bind(...binds).first<{ count: number }>();

  const rows = await env.DB.prepare(
    `SELECT page_id as pageId, page_title as pageTitle, page_url as pageUrl, canonical_url as canonicalUrl,
            views, visitors, sessions, search_views as searchViews, message_count as messageCount,
            last_view_at as lastViewAt, last_message_at as lastMessageAt, updated_at as updatedAt
     FROM analytics_page_totals
     ${where}
     ORDER BY views DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  return paginatedResponse(rows.results || [], total?.count || 0, page, limit, noCacheHeaders());
}

/** 查询时间段数据 */
async function queryDaily(env: any, opts: { page: number; limit: number; search: string; period: string; offset: number }) {
  const { page, limit, search, period, offset } = opts;

  // 根据时间段计算日期范围
  let dateCondition = '';
  let dateBind: string;
  switch (period) {
    case 'today':
      dateCondition = "date = date('now', '+8 hours')";
      dateBind = '';
      break;
    case 'yesterday':
      dateCondition = "date = date('now', '+8 hours', '-1 day')";
      dateBind = '';
      break;
    case '7d':
      dateCondition = "date >= date('now', '+8 hours', '-6 days')";
      dateBind = '';
      break;
    case '30d':
      dateCondition = "date >= date('now', '+8 hours', '-29 days')";
      dateBind = '';
      break;
    default:
      dateCondition = "date >= date('now', '+8 hours', '-6 days')";
      dateBind = '';
  }

  // 搜索条件
  let searchCondition = '';
  const binds: unknown[] = [];
  if (search) {
    searchCondition = 'AND (page_id LIKE ? OR page_title LIKE ? OR page_url LIKE ?)';
    const pattern = `%${search}%`;
    binds.push(pattern, pattern, pattern);
  }

  // 聚合查询
  const total = await env.DB.prepare(
    `SELECT COUNT(DISTINCT page_id) as count
     FROM analytics_page_daily
     WHERE ${dateCondition} ${searchCondition}`
  ).bind(...binds).first<{ count: number }>();

  const rows = await env.DB.prepare(
    `SELECT page_id as pageId,
            MAX(page_title) as pageTitle,
            MAX(page_url) as pageUrl,
            MAX(canonical_url) as canonicalUrl,
            SUM(views) as views,
            SUM(visitors) as visitors,
            SUM(sessions) as sessions,
            SUM(search_views) as searchViews,
            SUM(message_count) as messageCount,
            MAX(updated_at) as updatedAt
     FROM analytics_page_daily
     WHERE ${dateCondition} ${searchCondition}
     GROUP BY page_id
     ORDER BY views DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  // 补充 lastViewAt（从 page_totals 获取）
  const pageIds = (rows.results || []).map((r: any) => r.pageId);
  let lastViewMap = new Map<string, string>();
  if (pageIds.length > 0) {
    const lastViewRows = await env.DB.prepare(
      `SELECT page_id as pageId, last_view_at as lastViewAt, last_message_at as lastMessageAt
       FROM analytics_page_totals
       WHERE page_id IN (${pageIds.map(() => '?').join(',')})`
    ).bind(...pageIds).all<{ pageId: string; lastViewAt: string; lastMessageAt: string }>();

    for (const r of lastViewRows.results || []) {
      lastViewMap.set(r.pageId, r.lastViewAt);
    }
  }

  const items = (rows.results || []).map((r: any) => ({
    ...r,
    lastViewAt: lastViewMap.get(r.pageId) || null,
    lastMessageAt: null,
  }));

  return paginatedResponse(items, total?.count || 0, page, limit, noCacheHeaders());
}
