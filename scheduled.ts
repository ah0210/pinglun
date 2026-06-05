// scheduled.ts — Cron Trigger 入口
// 当前项目留言相关表数据量极低（博客留言板场景），无需定时清理：
// - email_verifications: 年增量 < 100 条，D1 额度完全不敏感
// - refresh_tokens: 年增量 < 1000 条，查询已按未过期过滤
// - login_attempts: 登录成功时自动清理 30 分钟前的记录
//
// 流量统计原始事件保留 90 天；聚合数据长期保留。
import type { Env } from './lib/types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const result = await env.DB.prepare(
      `DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days')`
    ).run();
    console.log(`[Cron] Cleaned analytics_events: ${result.meta.changes || 0}`);
  },
};
