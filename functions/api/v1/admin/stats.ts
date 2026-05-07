// functions/api/v1/admin/stats.ts — 数据统计面板
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { successResponse } from '../../../../lib/response';
import type { Env, JwtPayload } from '../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const today = new Date().toISOString().split('T')[0];

  const [totalMessages, todayMessages, totalUsers, pendingMessages, secretMessages] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) as count FROM messages').first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?').bind(today).first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE status = 'pending'").first<{ count: number }>(),
    env.DB.prepare('SELECT COUNT(*) as count FROM messages WHERE is_secret = 1').first<{ count: number }>(),
  ]);

  return successResponse({
    totalMessages: totalMessages?.count || 0,
    todayMessages: todayMessages?.count || 0,
    totalUsers: totalUsers?.count || 0,
    pendingMessages: pendingMessages?.count || 0,
    secretMessages: secretMessages?.count || 0,
  });
}, { requireAdmin: true });
