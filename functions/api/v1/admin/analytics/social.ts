// functions/api/v1/admin/analytics/social.ts — 社交传播分析
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

/** 社交平台域名映射 */
const SOCIAL_DOMAINS: Record<string, string> = {
  'weibo.com': '微博',
  'm.weibo.cn': '微博',
  'zhihu.com': '知乎',
  'zhuanlan.zhihu.com': '知乎',
  'douban.com': '豆瓣',
  'twitter.com': 'Twitter/X',
  'x.com': 'Twitter/X',
  't.co': 'Twitter/X',
  'facebook.com': 'Facebook',
  'm.facebook.com': 'Facebook',
  'linkedin.com': 'LinkedIn',
  'reddit.com': 'Reddit',
  'tumblr.com': 'Tumblr',
  'pinterest.com': 'Pinterest',
  'vk.com': 'VK',
  'mp.weixin.qq.com': '微信',
  'qq.com': 'QQ',
};

/** 根据 referrer_domain 识别社交平台名称 */
function getPlatformName(domain: string): string {
  // 精确匹配
  if (SOCIAL_DOMAINS[domain]) return SOCIAL_DOMAINS[domain];
  // 子域名匹配（如 link.zhihu.com → 知乎）
  for (const [key, name] of Object.entries(SOCIAL_DOMAINS)) {
    if (domain.endsWith('.' + key)) return name;
  }
  return domain;
}

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 1), 180);

  // 1. 社交平台来源分布（按平台聚合，而非原始域名）
  const domainRows = await env.DB.prepare(
    `SELECT referrer_domain as referrerDomain,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'social' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY referrer_domain
     ORDER BY views DESC
     LIMIT 50`
  ).bind(`-${days} days`).all<{ referrerDomain: string; views: number; visitors: number }>();

  // 按平台名称聚合（同一平台多个域名合并）
  const platformMap = new Map<string, { views: number; visitors: number; domains: string[] }>();
  for (const row of domainRows.results || []) {
    const platform = getPlatformName(row.referrerDomain);
    const existing = platformMap.get(platform);
    if (existing) {
      existing.views += row.views;
      existing.visitors += row.visitors;
      existing.domains.push(row.referrerDomain);
    } else {
      platformMap.set(platform, {
        views: row.views,
        visitors: row.visitors,
        domains: [row.referrerDomain],
      });
    }
  }

  const sources = Array.from(platformMap.entries())
    .map(([platform, data]) => ({
      platform,
      views: data.views,
      visitors: data.visitors,
      domains: data.domains,
    }))
    .sort((a, b) => b.views - a.views);

  // 2. 社交传播最多的页面
  const pages = await env.DB.prepare(
    `SELECT page_id as pageId,
            MAX(page_title) as pageTitle,
            MAX(page_url) as pageUrl,
            COUNT(*) as socialViews,
            COUNT(DISTINCT visitor_id) as socialVisitors
     FROM analytics_events
     WHERE channel = 'social' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY page_id
     ORDER BY socialViews DESC
     LIMIT 30`
  ).bind(`-${days} days`).all();

  // 3. 社交流量趋势（按天统计）
  const trend = await env.DB.prepare(
    `SELECT date(created_at, '+8 hours') as date,
            COUNT(*) as views,
            COUNT(DISTINCT visitor_id) as visitors
     FROM analytics_events
     WHERE channel = 'social' AND created_at >= datetime('now', '+8 hours', ?)
     GROUP BY date(created_at, '+8 hours')
     ORDER BY date ASC`
  ).bind(`-${days} days`).all();

  return successResponse({
    sources,
    pages: pages.results || [],
    trend: trend.results || [],
  }, noCacheHeaders());
}, { requireAdmin: true });
