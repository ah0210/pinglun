// functions/api/v1/admin/logs.ts — 操作日志
import { apiHandler } from '../../../../lib/middleware';
import { paginatedResponse } from '../../../../lib/response';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import type { Env, DbAdminLog, JwtPayload } from '../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const action = url.searchParams.get('action') || '';
  const adminId = url.searchParams.get('admin_id') || '';
  const search = url.searchParams.get('search') || '';

  let whereClause = 'WHERE 1=1';
  const binds: unknown[] = [];

  if (action) {
    whereClause += ' AND al.action = ?';
    binds.push(action);
  }
  if (adminId) {
    whereClause += ' AND al.admin_id = ?';
    binds.push(parseInt(adminId, 10));
  }
  if (search) {
    whereClause += ' AND (al.detail LIKE ? OR u.username LIKE ?)';
    binds.push(`%${search}%`, `%${search}%`);
  }

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM admin_logs al ${whereClause}`
  ).bind(...binds).first<{ total: number }>();

  const logs = await env.DB.prepare(
    `SELECT al.*, u.username as admin_username
     FROM admin_logs al
     JOIN users u ON al.admin_id = u.id
     ${whereClause}
     ORDER BY al.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, (page - 1) * limit).all<DbAdminLog & { admin_username: string }>();

  const items = (logs.results || []).map(l => ({
    id: l.id,
    adminId: l.admin_id,
    adminUsername: (l as any).admin_username,
    action: l.action,
    targetType: l.target_type,
    targetId: l.target_id,
    detail: l.detail,
    ipAddress: l.ip_address,
    createdAt: l.created_at,
  }));

  return paginatedResponse(items, countResult?.total || 0, page, limit, noCacheHeaders());
}, { requireAdmin: true });
