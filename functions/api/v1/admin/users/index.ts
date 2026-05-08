// functions/api/v1/admin/users/index.ts — 用户管理列表
import { apiHandler } from '../../../../../lib/middleware';
import { paginatedResponse } from '../../../../../lib/response';
import { getAvatarUrl } from '../../../../../lib/avatar';
import { noCacheHeaders } from '../../../../../lib/cache-headers';
import type { Env, DbUser, JwtPayload } from '../../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const role = url.searchParams.get('role') || '';
  const status = url.searchParams.get('status') || '';
  const search = url.searchParams.get('search') || '';

  let whereClause = 'WHERE 1=1';
  const binds: unknown[] = [];

  if (role) {
    whereClause += ' AND role = ?';
    binds.push(role);
  }
  if (status) {
    whereClause += ' AND status = ?';
    binds.push(status);
  }
  if (search) {
    whereClause += ' AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM users ${whereClause}`
  ).bind(...binds).first<{ total: number }>();

  const users = await env.DB.prepare(
    `SELECT id, username, display_name, email, email_verified, role, avatar, bio, status, last_login_at, created_at
     FROM users ${whereClause}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, (page - 1) * limit).all();

  const items = (users.results || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    displayName: u.display_name || u.username,
    email: u.email,
    emailVerified: u.email_verified === 1,
    avatar: u.avatar || getAvatarUrl(u.email),
    role: u.role,
    status: u.status,
    bio: u.bio,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  }));

  return paginatedResponse(items, countResult?.total || 0, page, limit, noCacheHeaders());
}, { requireAdmin: true });
