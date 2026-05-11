// scheduled.ts — Cron Trigger 入口
// 当前项目各表数据量极低（博客留言板场景），无需定时清理：
// - email_verifications: 年增量 < 100 条，D1 额度完全不敏感
// - refresh_tokens: 年增量 < 1000 条，查询已按未过期过滤
// - login_attempts: 登录成功时自动清理 30 分钟前的记录
//
// 如未来数据量大幅增长，可在此添加清理逻辑。
import type { Env } from './lib/types';

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log('[Cron] Scheduled trigger fired (no cleanup needed at current scale)');
  },
};
