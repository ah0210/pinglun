// functions/api/v1/admin/analytics/funnel.ts — 页面转化漏斗
import { apiHandler } from '../../../../../lib/middleware';
import { successResponse } from '../../../../../lib/response';
import { noCacheHeaders } from '../../../../../lib/cache-headers';

/** 漏斗阶段 */
interface FunnelStage {
  name: string;         // 阶段名称
  value: number;        // 数值
  rate: number;         // 相对上一阶段的转化率（0-1）
  dropoff: number;      // 流失率（1 - rate）
  tip: string;          // 优化建议
}

/** 页面漏斗 */
interface PageFunnel {
  pageId: string;
  pageTitle: string;
  pageUrl: string;
  stages: FunnelStage[];
  biggestDrop: string;  // 最大流失环节
  suggestion: string;   // 综合建议
}

/**
 * 转化漏斗分析
 * PV → UV → 互动访客（留言）→ 回访者
 */
export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 10), 1), 30);

  // 获取 Top N 页面的基础数据
  const topPages = await env.DB.prepare(
    `SELECT page_id as pageId,
            page_title as pageTitle,
            page_url as pageUrl,
            views,
            visitors,
            message_count as messageCount
     FROM analytics_page_totals
     WHERE views >= 10
     ORDER BY views DESC
     LIMIT ?`
  ).bind(limit).all<{ pageId: string; pageTitle: string; pageUrl: string; views: number; visitors: number; messageCount: number }>();

  const funnels: PageFunnel[] = [];

  for (const page of topPages.results || []) {
    const stages: FunnelStage[] = [];

    // 阶段1：PV（页面浏览量）
    stages.push({
      name: '页面浏览',
      value: page.views,
      rate: 1,
      dropoff: 0,
      tip: '',
    });

    // 阶段2：UV（独立访客）
    const uvRate = page.views > 0 ? page.visitors / page.views : 0;
    stages.push({
      name: '独立访客',
      value: page.visitors,
      rate: uvRate,
      dropoff: 1 - uvRate,
      tip: uvRate < 0.5 ? 'UV/PV 比低，同一访客重复浏览多，内容有粘性' : '',
    });

    // 阶段3：互动访客（留言的人）
    // messageCount 是留言数，保守估计每个留言者平均留 1.5 条
    const estimatedEngagers = Math.ceil(page.messageCount / 1.5);
    const engageRate = page.visitors > 0 ? Math.min(estimatedEngagers / page.visitors, 1) : 0;
    stages.push({
      name: '互动访客',
      value: estimatedEngagers,
      rate: engageRate,
      dropoff: 1 - engageRate,
      tip: engageRate < 0.05 && page.visitors > 100
        ? '互动率极低，评论区可能太靠下或缺少引导'
        : engageRate < 0.1
          ? '互动率偏低，可在文末增加互动引导语'
          : '',
    });

    // 阶段4：回访者（出现 >1 次的访客）
    // 从 daily_visitors 表统计出现 2 天以上的访客
    const revisitRow = await env.DB.prepare(
      `SELECT COUNT(DISTINCT visitor_id) as revisitVisitors
       FROM (
         SELECT visitor_id
         FROM analytics_daily_visitors
         WHERE page_id = ?
         GROUP BY visitor_id
         HAVING COUNT(DISTINCT date) >= 2
       )`
    ).bind(page.pageId).first<{ revisitVisitors: number }>();

    const revisitVisitors = revisitRow?.revisitVisitors || 0;
    const revisitRate = page.visitors > 0 ? revisitVisitors / page.visitors : 0;
    stages.push({
      name: '回访者',
      value: revisitVisitors,
      rate: revisitRate,
      dropoff: 1 - revisitRate,
      tip: revisitRate < 0.05 && page.visitors > 50
        ? '回访率极低，考虑增加系列内容或留言通知机制'
        : revisitRate < 0.1
          ? '回访率偏低，可通过邮件/微信提醒引导回访'
          : '',
    });

    // 找到最大流失环节
    let maxDropIdx = 1;
    let maxDrop = 0;
    for (let i = 1; i < stages.length; i++) {
      if (stages[i].dropoff > maxDrop) {
        maxDrop = stages[i].dropoff;
        maxDropIdx = i;
      }
    }

    // 综合建议
    let suggestion = '';
    if (maxDropIdx === 2 && stages[2].dropoff > 0.9) {
      suggestion = '最大流失在 UV→互动，建议优化评论区位置和互动引导';
    } else if (maxDropIdx === 3 && stages[3].dropoff > 0.9) {
      suggestion = '最大流失在互动→回访，建议增加留言通知和系列内容';
    } else if (maxDropIdx === 1 && stages[1].dropoff > 0.6) {
      suggestion = 'PV 重复浏览率高，内容有粘性但新访客不足，建议加强 SEO';
    }

    funnels.push({
      pageId: page.pageId,
      pageTitle: page.pageTitle || page.pageId,
      pageUrl: page.pageUrl,
      stages,
      biggestDrop: stages[maxDropIdx].name,
      suggestion,
    });
  }

  // 全站汇总漏斗
  const totalStats = await env.DB.prepare(
    `SELECT COALESCE(SUM(views), 0) as totalViews,
            COALESCE(SUM(visitors), 0) as totalVisitors,
            COALESCE(SUM(message_count), 0) as totalMessages
     FROM analytics_page_totals`
  ).first<{ totalViews: number; totalVisitors: number; totalMessages: number }>();

  const totalRevisitRow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT sub.visitor_id) as totalRevisitVisitors
     FROM (
       SELECT visitor_id
       FROM analytics_daily_visitors
       GROUP BY visitor_id
       HAVING COUNT(DISTINCT date) >= 2
     ) AS sub`
  ).first<{ totalRevisitVisitors: number }>();

  const totalViews = totalStats?.totalViews || 0;
  const totalVisitors = totalStats?.totalVisitors || 0;
  const totalMessages = totalStats?.totalMessages || 0;
  const totalRevisitVisitors = totalRevisitRow?.totalRevisitVisitors || 0;
  const totalEngagers = Math.ceil(totalMessages / 1.5);

  const overallStages: FunnelStage[] = [
    {
      name: '页面浏览',
      value: totalViews,
      rate: 1,
      dropoff: 0,
      tip: '',
    },
    {
      name: '独立访客',
      value: totalVisitors,
      rate: totalViews > 0 ? totalVisitors / totalViews : 0,
      dropoff: totalViews > 0 ? 1 - totalVisitors / totalViews : 0,
      tip: '',
    },
    {
      name: '互动访客',
      value: totalEngagers,
      rate: totalVisitors > 0 ? Math.min(totalEngagers / totalVisitors, 1) : 0,
      dropoff: totalVisitors > 0 ? 1 - Math.min(totalEngagers / totalVisitors, 1) : 0,
      tip: '',
    },
    {
      name: '回访者',
      value: totalRevisitVisitors,
      rate: totalVisitors > 0 ? totalRevisitVisitors / totalVisitors : 0,
      dropoff: totalVisitors > 0 ? 1 - totalRevisitVisitors / totalVisitors : 0,
      tip: '',
    },
  ];

  return successResponse({
    overall: { stages: overallStages },
    pages: funnels,
  }, noCacheHeaders());
}, { requireAdmin: true });
