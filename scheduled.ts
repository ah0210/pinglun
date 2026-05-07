// scheduled.ts — Cron Trigger 入口（每天 UTC 00:00 清理过期数据）
import type { Env } from './lib/types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Starting scheduled cleanup...');

    try {
      // 清理过期验证记录
      const verifResult = await env.DB.prepare(
        "DELETE FROM email_verifications WHERE expires_at < datetime('now') AND verified = 0"
      ).run();
      console.log(`[Cron] Deleted ${verifResult.meta.changes} expired verifications`);

      // 清理过期 Refresh Token
      const tokenResult = await env.DB.prepare(
        "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
      ).run();
      console.log(`[Cron] Deleted ${tokenResult.meta.changes} expired refresh tokens`);

      // 清理已吊销超过 30 天的 Refresh Token
      const revokedResult = await env.DB.prepare(
        "DELETE FROM refresh_tokens WHERE revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')"
      ).run();
      console.log(`[Cron] Deleted ${revokedResult.meta.changes} old revoked tokens`);

      console.log('[Cron] Cleanup completed successfully');
    } catch (error) {
      console.error('[Cron] Cleanup failed:', error);
    }
  },
};
