// functions/api/v1/admin/analytics/pages.ts — 页面表现列表
import { apiHandler } from '../../../../../lib/middleware';
import { paginatedResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

const SORT_COLUMNS: Record<string, string> = {
  views: 'views',
  visitors: 'visitors',
  sessions: 'sessions',
  searchViews: 'search_views',
  messageCount: 'message_count',
  updatedAt: 'updated_at',
};

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
  const search = (url.searchParams.get('search') || '').trim();
  const sort = SORT_COLUMNS[url.searchParams.get('sort') || 'views'] || 'views';
  const order = url.searchParams.get('order') === 'asc' ? 'ASC' : 'DESC';
  const offset = (page - 1) * limit;

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
     ORDER BY ${sort} ${order}
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  return paginatedResponse(rows.results || [], total?.count || 0, page, limit, noCacheHeaders());
}, { requireAdmin: true });

