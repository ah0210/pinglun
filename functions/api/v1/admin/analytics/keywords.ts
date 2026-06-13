// functions/api/v1/admin/analytics/keywords.ts — 搜索关键词反查
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

/** 关键词统计行 */
interface KeywordRow {
  keyword: string;
  views: number;
  visitors: number;
  pages: number;       // 落在多少个不同页面
}

/** 关键词对应的页面 */
interface KeywordPageRow {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  views: number;
  visitors: number;
}

/** 搜索引擎关键词参数映射 */
const SEARCH_QUERY_PARAMS: Record<string, string[]> = {
  'baidu.com': ['wd', 'word', 'kw'],
  'google.com': ['q'],
  'google.com.hk': ['q'],
  'bing.com': ['q'],
  'sogou.com': ['query'],
  'so.com': ['q'],
  'yahoo.com': ['p'],
  'yandex.com': ['text'],
  'duckduckgo.com': ['q'],
  'shenma.cn': ['q'],
  'sm.cn': ['q'],
};

/**
 * 从 referrer URL 中提取搜索关键词
 * 部分搜索引擎仍会在 referrer URL 中传递搜索关键词
 */
function extractKeyword(referrer: string): string {
  if (!referrer) return '';
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

    // 查找匹配的搜索引擎参数
    for (const [domain, params] of Object.entries(SEARCH_QUERY_PARAMS)) {
      if (host === domain || host.endsWith('.' + domain)) {
        for (const param of params) {
          const value = url.searchParams.get(param);
          if (value && value.trim()) {
            return decodeURIComponent(value.trim());
          }
        }
      }
    }
  } catch {
    // URL 解析失败
  }
  return '';
}

/**
 * 搜索关键词反查
 * 从 referrer URL 中提取搜索关键词，聚合统计
 */
export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(Number(url.searchParams.get('days') || 30), 1), 180);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

  // 1. 获取搜索渠道的 referrer 数据
  const referrerRows = await env.DB.prepare(
    `SELECT referrer, page_id, page_title, page_url, visitor_id
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
       AND referrer != ''
     ORDER BY created_at DESC
     LIMIT 5000`
  ).bind(`-${days} days`).all<{ referrer: string; page_id: string; page_title: string; page_url: string; visitor_id: string }>();

  // 2. 提取关键词并聚合
  const keywordMap = new Map<string, { views: number; visitors: Set<string>; pageIds: Set<string>; pages: Map<string, { pageTitle: string; pageUrl: string; views: number; visitors: Set<string> }> }>();

  let extractedCount = 0;
  let notProvidedCount = 0;

  for (const row of referrerRows.results || []) {
    const keyword = extractKeyword(row.referrer);

    if (!keyword) {
      notProvidedCount++;
      continue;
    }

    extractedCount++;

    const existing = keywordMap.get(keyword);
    if (existing) {
      existing.views++;
      existing.visitors.add(row.visitor_id);
      existing.pageIds.add(row.page_id);

      // 页面级别统计
      const pageData = existing.pages.get(row.page_id);
      if (pageData) {
        pageData.views++;
        pageData.visitors.add(row.visitor_id);
      } else {
        existing.pages.set(row.page_id, {
          pageTitle: row.page_title,
          pageUrl: row.page_url,
          views: 1,
          visitors: new Set([row.visitor_id]),
        });
      }
    } else {
      const pagesMap = new Map<string, { pageTitle: string; pageUrl: string; views: number; visitors: Set<string> }>();
      pagesMap.set(row.page_id, {
        pageTitle: row.page_title,
        pageUrl: row.page_url,
        views: 1,
        visitors: new Set([row.visitor_id]),
      });
      keywordMap.set(keyword, {
        views: 1,
        visitors: new Set([row.visitor_id]),
        pageIds: new Set([row.page_id]),
        pages: pagesMap,
      });
    }
  }

  // 3. 排序并格式化输出
  const keywords: KeywordRow[] = Array.from(keywordMap.entries())
    .map(([keyword, data]) => ({
      keyword,
      views: data.views,
      visitors: data.visitors.size,
      pages: data.pageIds.size,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);

  // 4. 获取 Top 关键词对应的页面详情
  const topKeywordsWithPages = keywords.slice(0, 20).map(kw => {
    const data = keywordMap.get(kw.keyword)!;
    const pages: KeywordPageRow[] = Array.from(data.pages.entries())
      .map(([pageId, pData]) => ({
        pageId,
        pageTitle: pData.pageTitle,
        pageUrl: pData.pageUrl,
        views: pData.views,
        visitors: pData.visitors.size,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);

    return { ...kw, topPages: pages };
  });

  // 5. 搜索引擎分布（哪些引擎传了关键词，哪些没传）
  const engineKeywordStats = await env.DB.prepare(
    `SELECT referrer_domain as engine,
            COUNT(*) as totalViews,
            COUNT(CASE WHEN referrer LIKE '%q=%' OR referrer LIKE '%wd=%' OR referrer LIKE '%word=%'
                        OR referrer LIKE '%query=%' OR referrer LIKE '%kw=%' OR referrer LIKE '%p=%'
                        OR referrer LIKE '%text=%' THEN 1 END) as withKeywordViews
     FROM analytics_events
     WHERE channel = 'search' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY referrer_domain
     ORDER BY totalViews DESC
     LIMIT 10`
  ).bind(`-${days} days`).all<{ engine: string; totalViews: number; withKeywordViews: number }>();

  return successResponse({
    keywords,
    topKeywordsWithPages,
    engineStats: (engineKeywordStats.results || []).map(r => ({
      ...r,
      notProvidedRate: r.totalViews > 0 ? ((r.totalViews - r.withKeywordViews) / r.totalViews * 100).toFixed(1) + '%' : '0%',
    })),
    summary: {
      totalSearchEvents: referrerRows.results?.length || 0,
      extractedKeywords: extractedCount,
      notProvided: notProvidedCount,
      extractionRate: (referrerRows.results?.length || 0) > 0
        ? ((extractedCount / referrerRows.results.length) * 100).toFixed(1) + '%'
        : '0%',
      uniqueKeywords: keywordMap.size,
    },
  }, noCacheHeaders());
}, { requireAdmin: true });
