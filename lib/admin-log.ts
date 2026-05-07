// lib/admin-log.ts — 管理员操作日志

import type { Env } from './types';

export async function logAdminAction(
  env: Env,
  adminId: number,
  action: string,
  targetType: string = '',
  targetId: number | null = null,
  detail: string = '',
  ipAddress: string = ''
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO admin_logs (admin_id, action, target_type, target_id, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(adminId, action, targetType, targetId, detail, ipAddress).run();
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
