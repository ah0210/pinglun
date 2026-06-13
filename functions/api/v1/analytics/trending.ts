// functions/api/v1/analytics/trending.ts — 热门页面排行榜（公开接口）
import { apiHandler } from '../../../../lib/middleware';
import { cacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';

/** 允许的排序字段（白名单，防止 SQL 注入） */
const SORT_COLUMNS: Record<string, string> = {
  views: 'views',
  visitors: 'visitors',
  messageCount: 'message_count',
};

/**
 * 清洗页面标题，去掉站点后缀
 * 例如 "文章标题 - 自游人（一起游） - 专注AI旅行与赚钱技术的自由行社区 17you.com"
 * → "文章标题"
 *
 * 策略：从右向左逐段去掉 " - xxx"，直到遇到非站点名段
 * 站点名特征：包含 "自游人"、"一起游"、"17you"、"社区" 等关键词
 */
function cleanTitle(title: string): string {
  if (!title) return '';
  let cleaned = title.trim();
  // 反复去掉右侧的站点名后缀段
  while (cleaned.includes(' - ')) {
    const lastDash = cleaned.lastIndexOf(' - ');
    const suffix = cleaned.slice(lastDash + 3).trim();
    // 判断后缀是否是站点名（包含特征关键词）
    if (/(自游人|一起游|17you|专注.*社区|自由行社区)/i.test(suffix)) {
      cleaned = cleaned.slice(0, lastDash).trim();
    } else {
      break;
    }
  }
  return cleaned;
}

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '10', 10), 1), 50);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);
  const sortBy = SORT_COLUMNS[url.searchParams.get('sortBy') || 'views'] || 'views';

  // 从日聚合表查询近期热门（比查原始事件表快得多）
  const rows = await env.DB.prepare(
    `SELECT page_id as pageId,
            MAX(page_title) as pageTitle,
            MAX(page_url) as pageUrl,
            MAX(canonical_url) as canonicalUrl,
            SUM(views) as views,
            SUM(visitors) as visitors,
            SUM(message_count) as messageCount
     FROM analytics_page_daily
     WHERE date >= date('now', '+8 hours', ?)
     GROUP BY page_id
     ORDER BY ${sortBy} DESC
     LIMIT ?`
  ).bind(`-${days} days`, limit).all<{
    pageId: string;
    pageTitle: string;
    pageUrl: string;
    canonicalUrl: string;
    views: number;
    visitors: number;
    messageCount: number;
  }>();

  // 安全过滤：只返回有 pageUrl 或 canonicalUrl 的页面，避免暴露内部 pageId
  const items = (rows.results || [])
    .filter(row => row.pageUrl || row.canonicalUrl)
    .map(row => ({
      pageId: row.pageId,
      pageTitle: cleanTitle(row.pageTitle || ''),
      pageUrl: row.canonicalUrl || row.pageUrl,
      views: row.views || 0,
      visitors: row.visitors || 0,
      messageCount: row.messageCount || 0,
    }));

  return successResponse(items, {
    ...cacheHeaders(600),
    'Content-Type': 'application/json',
  });
}, { requireAuth: false });
