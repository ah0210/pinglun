// functions/api/v1/messages/index.ts — 留言列表 + 提交留言
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { verifyTurnstile, shouldSkipTurnstile } from '../../../../lib/turnstile';
import { escapeHtml } from '../../../../lib/sanitize';
import { noCacheHeaders, cacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse, cursorPaginatedResponse } from '../../../../lib/response';
import { toPublicUser } from '../../../../lib/types';
import { adjustMessageCount } from '../../../../lib/analytics';
import type { DbMessage, PublicUser } from '../../../../lib/types';

// GET — 留言列表（游标分页，无 COUNT，CDN 可缓存）
// 安全策略：秘密留言/审核留言的真实 content 在后端脱敏（设为 null），
// 前端根据 user.role 本地决定显示占位文字还是请求真实内容。
// 这样 CDN 缓存的是脱敏后的公共版本，无隐私泄露风险。
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const url = new URL(request.url);
  const pageId = url.searchParams.get('pageId') || '';
  const cursor = url.searchParams.get('cursor') || '';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  let whereClause: string;
  const binds: unknown[] = [pageId];

  whereClause = 'WHERE m.page_id = ?';

  if (cursor) {
    whereClause += ' AND m.created_at < ?';
    binds.push(cursor);
  }

  const fetchLimit = limit + 1;

  const messages = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.role as user_role, u.bio,
            r.id as reply_id, r.content as reply_content, r.is_secret as reply_is_secret, r.status as reply_status,
            r.user_id as reply_user_id,
            ru.username as reply_username, ru.display_name as reply_display_name
     FROM messages m
     JOIN users u ON m.user_id = u.id
     LEFT JOIN messages r ON m.reply_to = r.id
     LEFT JOIN users ru ON r.user_id = ru.id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT ?`
  ).bind(...binds, fetchLimit).all<DbMessage & {
    username: string; display_name: string; avatar: string; user_role: string; bio: string;
    reply_id: number | null; reply_content: string | null; reply_is_secret: number | null; reply_status: string | null;
    reply_user_id: number | null; reply_username: string | null; reply_display_name: string | null;
  }>();

  const allResults = messages.results || [];
  const hasMore = allResults.length > limit;
  const results = hasMore ? allResults.slice(0, limit) : allResults;

  const nextCursor = hasMore && results.length > 0
    ? results[results.length - 1].created_at
    : null;

  /**
   * 构建留言列表项（CDN 缓存安全版）
   * - 秘密留言 content 设为 null（前端根据 role 遮掩）
   * - 非 approved 留言 content 设为 null（前端根据 role 遮掩）
   * - 被回复留言同理脱敏
   * - 所有留言附带 isSecret + status，前端据此决定显示
   */
  const items = results.map(m => {
    const publicUser: ReturnType<typeof toPublicUser> = {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name || m.username,
      avatar: m.avatar,
      role: m.user_role,
      bio: m.bio,
    };

    /** 主留言内容脱敏：秘密留言或非 approved 留言设为 null */
    let content: string | null = m.content;
    if (m.is_secret === 1) {
      content = null;
    } else if (m.status !== 'approved') {
      content = null;
    }

    /** 被回复留言摘要脱敏：同规则 */
    let replyToMessage: { id: number; username: string; displayName: string; content: string | null; isSecret: boolean; status: string } | undefined;
    if (m.reply_to && m.reply_id) {
      let replyContent: string | null = m.reply_content || '';
      const replyStatus = m.reply_status || 'approved';
      if (m.reply_is_secret === 1) {
        replyContent = null;
      } else if (replyStatus !== 'approved') {
        replyContent = null;
      }
      replyToMessage = {
        id: m.reply_id,
        username: m.reply_username || '',
        displayName: m.reply_display_name || m.reply_username || '',
        content: replyContent,
        isSecret: m.reply_is_secret === 1,
        status: replyStatus,
      };
    }

    return {
      id: m.id,
      pageId: m.page_id,
      pageUrl: m.page_url || '',
      content,
      isSecret: m.is_secret === 1,
      status: m.status,
      replyTo: m.reply_to,
      replyToMessage,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      user: publicUser,
    };
  });

  /**
   * CDN 缓存 300s（5 分钟），浏览器 30s + stale-while-revalidate
   * 脱敏后无隐私风险，可安全缓存
   */
  const headers = { ...cacheHeaders(300), 'Content-Type': 'application/json' };
  return cursorPaginatedResponse(items, limit, nextCursor, headers);
}, { requireAuth: false });

// POST — 提交留言（需登录 + 邮箱已验证，管理员豁免）
export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  if (!user) {
    return errorResponse(ErrorCode.UNAUTHORIZED, '请先登录', 401);
  }

  // 并行获取：用户邮箱验证状态 + 全量配置
  const [dbUserVerify, config] = await Promise.all([
    user.role !== 'admin'
      ? env.DB.prepare('SELECT email_verified FROM users WHERE id = ?').bind(user.userId).first<{ email_verified: number }>()
      : Promise.resolve(null),
    env.DB.prepare(
      'SELECT min_message_length, max_message_length, require_captcha, daily_secret_limit, moderation_enabled, force_skip_turnstile, require_email_verification FROM board_config WHERE id = 1'
    ).first<{ min_message_length: number; max_message_length: number; require_captcha: number; daily_secret_limit: number; moderation_enabled: number; force_skip_turnstile: number; require_email_verification: number }>()
  ]);

  // 邮箱验证检查（管理员豁免；require_email_verification 开关可由管理员关闭用于紧急降级）
  if (user.role !== 'admin' && dbUserVerify && !dbUserVerify.email_verified) {
    if (!config || config.require_email_verification) {
      return errorResponse(ErrorCode.EMAIL_NOT_VERIFIED, '请先验证邮箱后再留言', 403);
    }
  }

  const body = await request.json() as {
    content: string;
    pageId: string;
    pageUrl?: string;
    isSecret?: boolean;
    replyTo?: number;
    turnstileToken?: string;
  };

  if (!body.content || !body.pageId) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写留言内容和页面ID', 400);
  }

  // 校验回复目标
  if (body.replyTo) {
    const replyTarget = await env.DB.prepare(
      'SELECT id, page_id FROM messages WHERE id = ?'
    ).bind(body.replyTo).first<{ id: number; page_id: string }>();
    if (!replyTarget) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '回复的留言不存在', 400);
    }
    if (replyTarget.page_id !== body.pageId) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '不能跨页面回复留言', 400);
    }
  }

  const minLength = config?.min_message_length || 2;
  const maxLength = config?.max_message_length || 500;

  // 验证留言长度
  if (body.content.trim().length < minLength) {
    return errorResponse(ErrorCode.MESSAGE_TOO_SHORT, `留言至少需要 ${minLength} 个字`, 400);
  }
  if (body.content.length > maxLength) {
    return errorResponse(ErrorCode.MESSAGE_TOO_LONG, `留言不能超过 ${maxLength} 字`, 400);
  }

  // 连续相同字符检查（超过5个连续相同字符则拒绝）
  if (/(.)\1{5,}/.test(body.content)) {
    return errorResponse(ErrorCode.MESSAGE_REPEATED_CHARS, '留言不能包含过多连续重复字符', 400);
  }

  // 验证码检查（仅管理员开启紧急降级时跳过）
  if (config?.require_captcha && !shouldSkipTurnstile(env.TURNSTILE_SECRET_KEY || '', config?.force_skip_turnstile === 1)) {
    if (!body.turnstileToken || !body.turnstileToken.trim()) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '请完成验证码验证', 400);
    }
    const valid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY, getClientIp(request));
    if (!valid) {
      return errorResponse(ErrorCode.TURNSTILE_FAILED, '验证码验证失败', 400);
    }
  }

  // 秘密留言额度检查
  if (body.isSecret) {
    if (user.role !== 'admin') {
      const today = new Date().toISOString().split('T')[0];
      const secretCount = await env.DB.prepare(
        `SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_secret = 1 AND date(created_at) = ?`
      ).bind(user.userId, today).first<{ count: number }>();

      const dailyLimit = config?.daily_secret_limit || 5;
      if (secretCount && secretCount.count >= dailyLimit) {
        return errorResponse(ErrorCode.SECRET_LIMIT_EXCEEDED, `每天最多 ${dailyLimit} 条秘密留言`, 403);
      }
    }
  }

  // 确定留言状态
  const status = config?.moderation_enabled ? 'pending' : 'approved';

  // 转义 XSS
  const content = escapeHtml(body.content);
  const ipAddress = getClientIp(request);

  // 插入留言
  const result = await env.DB.prepare(
    `INSERT INTO messages (user_id, page_id, page_url, content, is_secret, reply_to, status, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.userId, body.pageId, body.pageUrl || '', content, body.isSecret ? 1 : 0, body.replyTo || null, status, ipAddress).run();

  if (status === 'approved') {
    await adjustMessageCount(env, body.pageId, body.pageUrl || '', new Date().toISOString(), 1);
  }

  // 返回完整消息对象，便于前端乐观更新
  const dbUser = await env.DB.prepare('SELECT display_name FROM users WHERE id = ?').bind(user.userId).first<{ display_name: string | null }>();
  const publicUser: PublicUser = {
    id: user.userId,
    username: user.username,
    displayName: dbUser?.display_name || user.username,
    avatar: '',
    role: user.role,
    bio: '',
  };
  const newMessage = {
    id: result.meta.last_row_id as number,
    pageId: body.pageId,
    pageUrl: body.pageUrl || '',
    content,
    isSecret: !!body.isSecret,
    status,
    replyTo: body.replyTo || null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    user: publicUser,
  };

  return successResponse({
    ...newMessage,
    message: status === 'pending' ? '留言已提交，等待审核' : '留言发布成功',
  }, noCacheHeaders());
}, { requireAuth: true });
