// functions/api/v1/admin/analytics/anomalies.ts — 流量异常检测
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

/** 异常事件 */
interface AnomalyEvent {
  metric: string;       // 指标名称：pv / uv / searchPv / messages
  level: 'warning' | 'critical';
  direction: 'up' | 'down';
  todayValue: number;   // 今日实际值
  avgValue: number;     // 过去 7 天均值
  changePercent: number;// 变化百分比
  possibleCause: string;// 可能原因
  suggestion: string;   // 建议操作
}

/**
 * 流量异常检测
 * 使用移动平均 + 标准差方法：
 * - 超过 均值 + 2σ → 异常上升
 * - 低于 均值 - 2σ → 异常下降
 */
export const onRequestGet = apiHandler(async (request, env) => {
  // 取近 8 天的每日数据（7 天基准 + 1 天今日）
  const dailyRows = await env.DB.prepare(
    `SELECT date as d,
            SUM(views) as pv,
            SUM(visitors) as uv,
            SUM(search_views) as searchPv,
            SUM(message_count) as messages
     FROM analytics_page_daily
     WHERE date >= date('now', '+8 hours', '-7 days')
     GROUP BY date
     ORDER BY d ASC`
  ).all<{ d: string; pv: number; uv: number; searchPv: number; messages: number }>();

  const rows = dailyRows.results || [];
  if (rows.length < 3) {
    // 数据不足，无法检测异常
    return successResponse({ anomalies: [], dataPoints: rows.length }, noCacheHeaders());
  }

  // 分离：基准期（除最后一天）和今日
  const today = rows[rows.length - 1];
  const baseline = rows.slice(0, -1);

  const anomalies: AnomalyEvent[] = [];

  /** 计算均值和标准差 */
  function stats(values: number[]) {
    const n = values.length;
    if (n === 0) return { mean: 0, std: 0 };
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return { mean, std: Math.sqrt(variance) };
  }

  /** 检测单个指标 */
  function checkMetric(
    metric: string,
    label: string,
    todayVal: number,
    baselineVals: number[],
    causes: { up: string; down: string },
    suggestions: { up: string; down: string },
  ) {
    const { mean, std } = stats(baselineVals);
    if (mean === 0) return; // 无基准数据

    const upperThreshold = mean + 2 * std;
    const lowerThreshold = Math.max(0, mean - 2 * std);
    const changePercent = mean > 0 ? ((todayVal - mean) / mean) * 100 : 0;

    if (todayVal > upperThreshold) {
      anomalies.push({
        metric,
        level: changePercent > 100 ? 'critical' : 'warning',
        direction: 'up',
        todayValue: todayVal,
        avgValue: Math.round(mean),
        changePercent: Math.round(changePercent),
        possibleCause: causes.up,
        suggestion: suggestions.up,
      });
    } else if (todayVal < lowerThreshold) {
      anomalies.push({
        metric,
        level: changePercent < -50 ? 'critical' : 'warning',
        direction: 'down',
        todayValue: todayVal,
        avgValue: Math.round(mean),
        changePercent: Math.round(changePercent),
        possibleCause: causes.down,
        suggestion: suggestions.down,
      });
    }
  }

  // 检测各指标
  checkMetric('pv', '页面浏览量',
    today.pv, baseline.map(r => r.pv),
    { up: '社交传播爆发 / 爬虫攻击 / 内容被推荐', down: '页面故障 / CDN 异常 / 搜索排名下降' },
    { up: '检查渠道分布，区分真实流量和爬虫', down: '检查页面可访问性和搜索引擎收录状态' },
  );

  checkMetric('uv', '独立访客数',
    today.uv, baseline.map(r => r.uv),
    { up: '新流量来源 / 营销活动生效', down: '老用户流失 / 页面入口减少' },
    { up: '确认流量来源质量，关注留存', down: '检查外部链接是否失效' },
  );

  checkMetric('searchPv', '搜索流量',
    today.searchPv, baseline.map(r => r.searchPv),
    { up: '搜索排名提升 / 热门关键词匹配', down: '搜索引擎降权 / 算法更新 / 收录减少' },
    { up: '抓住机会优化相关内容', down: '检查 Search Console，确认收录和排名状态' },
  );

  checkMetric('messages', '留言数',
    today.messages, baseline.map(r => r.messages),
    { up: '内容引发讨论 / 垃圾留言攻击', down: '互动引导不足 / 评论区异常' },
    { up: '检查留言内容，排除垃圾攻击', down: '检查评论区加载是否正常' },
  );

  // 按严重程度排序：critical > warning，down > up
  anomalies.sort((a, b) => {
    if (a.level !== b.level) return a.level === 'critical' ? -1 : 1;
    if (a.direction !== b.direction) return a.direction === 'down' ? -1 : 1;
    return Math.abs(b.changePercent) - Math.abs(a.changePercent);
  });

  return successResponse({
    anomalies,
    dataPoints: rows.length,
    today: { date: today.d, pv: today.pv, uv: today.uv, searchPv: today.searchPv, messages: today.messages },
    baseline: { avgPv: Math.round(stats(baseline.map(r => r.pv)).mean), avgUv: Math.round(stats(baseline.map(r => r.uv)).mean) },
  }, noCacheHeaders());
}, { requireAdmin: true });
