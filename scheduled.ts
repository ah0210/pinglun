// scheduled.ts — Cron Trigger 入口（每天 UTC 00:00 清理过期数据）
import type { Env } from './lib/types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Starting scheduled cleanup...');

    const results: string[] = [];
    let hasError = false;

    try {
      // 清理过期验证记录
      try {
        const verifResult = await env.DB.prepare(
          "DELETE FROM email_verifications WHERE expires_at < datetime('now') AND verified = 0"
        ).run();
        const count = verifResult.meta.changes;
        results.push(`过期验证: ${count} 条`);
        console.log(`[Cron] Deleted ${count} expired verifications`);
      } catch (e) {
        hasError = true;
        results.push(`过期验证: 失败 - ${e}`);
        console.error('[Cron] Failed to clean verifications:', e);
      }

      // 清理过期 Refresh Token
      try {
        const tokenResult = await env.DB.prepare(
          "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
        ).run();
        const count = tokenResult.meta.changes;
        results.push(`过期 Token: ${count} 个`);
        console.log(`[Cron] Deleted ${count} expired refresh tokens`);
      } catch (e) {
        hasError = true;
        results.push(`过期 Token: 失败 - ${e}`);
        console.error('[Cron] Failed to clean tokens:', e);
      }

      // 清理已吊销超过 30 天的 Refresh Token
      try {
        const revokedResult = await env.DB.prepare(
          "DELETE FROM refresh_tokens WHERE revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')"
        ).run();
        const count = revokedResult.meta.changes;
        results.push(`历史吊销 Token: ${count} 个`);
        console.log(`[Cron] Deleted ${count} old revoked tokens`);
      } catch (e) {
        hasError = true;
        results.push(`历史吊销 Token: 失败 - ${e}`);
        console.error('[Cron] Failed to clean revoked tokens:', e);
      }

      // 清理 7 天前的登录尝试记录（仅保留近期数据用于频率限制）
      try {
        const attemptResult = await env.DB.prepare(
          "DELETE FROM login_attempts WHERE created_at < datetime('now', '-7 days')"
        ).run();
        const count = attemptResult.meta.changes;
        results.push(`过期登录记录: ${count} 条`);
        console.log(`[Cron] Deleted ${count} old login attempts`);
      } catch (e) {
        hasError = true;
        results.push(`过期登录记录: 失败 - ${e}`);
        console.error('[Cron] Failed to clean login attempts:', e);
      }

      if (hasError) {
        console.error(`[Cron] Cleanup completed with errors: ${results.join('; ')}`);
      } else {
        console.log(`[Cron] Cleanup completed successfully: ${results.join('; ')}`);
      }
    } catch (error) {
      console.error('[Cron] Cleanup failed with unexpected error:', error);
    }
  },
};
