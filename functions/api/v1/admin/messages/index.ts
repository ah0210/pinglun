// functions/api/v1/admin/messages/index.ts — 留言管理列表
import { apiHandler } from '../../../../../lib/middleware';
import { paginatedResponse } from '../../../../../lib/response';
import { getAvatarUrl } from '../../../../../lib/avatar';
import { noCacheHeaders } from '../../../../../lib/cache-headers';
import type { Env, DbMessage, JwtPayload } from '../../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status') || '';
  const isSecret = url.searchParams.get('is_secret') || '';
  const search = url.searchParams.get('search') || '';

  let whereClause = 'WHERE 1=1';
  const binds: unknown[] = [];

  if (status) {
    whereClause += ' AND m.status = ?';
    binds.push(status);
  }
  if (isSecret !== '') {
    whereClause += ' AND m.is_secret = ?';
    binds.push(isSecret === '1' ? 1 : 0);
  }
  if (search) {
    whereClause += ' AND m.content LIKE ?';
    binds.push(`%${search}%`);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM messages m ${whereClause}`
  ).bind(...binds).first<{ total: number }>();

  const messages = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.email, u.role as user_role
     FROM messages m
     JOIN users u ON m.user_id = u.id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, (page - 1) * limit).all<DbMessage & { username: string; display_name: string; avatar: string; email: string; user_role: string }>();

  const items = (messages.results || []).map(m => ({
    id: m.id,
    pageId: m.page_id,
    content: m.content,
    isSecret: m.is_secret === 1,
    status: m.status,
    replyTo: m.reply_to,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    user: {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name || m.username,
      avatar: m.avatar || getAvatarUrl(m.email),
      role: m.user_role,
    },
  }));

  return paginatedResponse(items, countResult?.total || 0, page, limit, noCacheHeaders());
}, { requireAdmin: true });
