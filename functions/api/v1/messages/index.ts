// functions/api/v1/messages/index.ts — 留言列表 + 提交留言
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { verifyTurnstile, shouldSkipTurnstile } from '../../../../lib/turnstile';
import { escapeHtml } from '../../../../lib/sanitize';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse, cursorPaginatedResponse } from '../../../../lib/response';
import { toPublicUser } from '../../../../lib/types';
import type { DbMessage, PublicUser } from '../../../../lib/types';

// GET — 留言列表（游标分页，无 COUNT，秘密留言按权限过滤）
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const url = new URL(request.url);
  const pageId = url.searchParams.get('pageId') || '';
  const cursor = url.searchParams.get('cursor') || '';  // 上一页最后一条的 created_at
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  // 构建查询条件
  let whereClause: string;
  const binds: unknown[] = [pageId];

  if (user?.role === 'admin') {
    whereClause = 'WHERE m.page_id = ?';
  } else if (user) {
    whereClause = 'WHERE m.page_id = ? AND (m.status = ? OR (m.status = ? AND m.user_id = ?))';
    binds.push('approved', 'pending', user.userId);
  } else {
    whereClause = 'WHERE m.page_id = ? AND m.status = ?';
    binds.push('approved');
  }

  // 游标条件：如果传了 cursor（上一页最后一条的 created_at），追加 WHERE
  if (cursor) {
    whereClause += ' AND m.created_at < ?';
    binds.push(cursor);
  }

  // 多取 1 条来判断是否有下一页（hasMore）
  const fetchLimit = limit + 1;

  // 获取留言列表（LEFT JOIN 被回复留言的信息）
  // 注意：不获取 u.email，避免邮箱数据泄露风险；avatar 字段在注册时已生成完整 URL
  const messages = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.role as user_role, u.bio,
            r.id as reply_id, r.content as reply_content, r.is_secret as reply_is_secret,
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
    reply_id: number | null; reply_content: string | null; reply_is_secret: number | null;
    reply_user_id: number | null; reply_username: string | null; reply_display_name: string | null;
  }>();

  const allResults = messages.results || [];
  const hasMore = allResults.length > limit;
  // 截取实际需要的数量
  const results = hasMore ? allResults.slice(0, limit) : allResults;

  // 下一页游标：当前页最后一条的 created_at
  const nextCursor = hasMore && results.length > 0
    ? results[results.length - 1].created_at
    : null;

  // 处理秘密留言内容
  const items = results.map(m => {
    const publicUser: ReturnType<typeof toPublicUser> = {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name || m.username,
      avatar: m.avatar,  // avatar 在注册时已生成完整 URL，无需 email
      role: m.user_role,
      bio: m.bio,
    };

    let content = m.content;

    // 秘密留言：仅留言者和管理员可见内容，其他人看到占位文字
    if (m.is_secret === 1) {
      if (!user || (user.role !== 'admin' && m.user_id !== user.userId)) {
        content = '🔒 这是一条秘密留言';
      }
    }

    // 构建被回复留言摘要
    let replyToMessage: { id: number; username: string; displayName: string; content: string; isSecret: boolean } | undefined;
    if (m.reply_to && m.reply_id) {
      let replyContent = m.reply_content || '';
      // 被回复留言的秘密内容也需按权限隐藏
      if (m.reply_is_secret === 1) {
        if (!user || (user.role !== 'admin' && m.reply_user_id !== user.userId)) {
          replyContent = '🔒 这是一条秘密留言';
        }
      }
      // 截断摘要，最多 80 字
      if (replyContent.length > 80) {
        replyContent = replyContent.slice(0, 80) + '...';
      }
      replyToMessage = {
        id: m.reply_id,
        username: m.reply_username || '',
        displayName: m.reply_display_name || m.reply_username || '',
        content: replyContent,
        isSecret: m.reply_is_secret === 1,
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

  // 留言列表包含用户角色相关数据（秘密留言/待审核留言），禁止 CDN 缓存
  const headers = { ...noCacheHeaders(), ...{ 'Content-Type': 'application/json' } };
  return cursorPaginatedResponse(items, limit, nextCursor, headers);
}, { requireAuth: false });

// POST — 提交留言（需登录 + 邮箱已验证，管理员豁免）
export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  if (!user) {
    return errorResponse(ErrorCode.UNAUTHORIZED, '请先登录', 401);
  }

  // 邮箱验证检查（管理员豁免；require_email_verification 开关可由管理员关闭用于紧急降级）
  if (user.role !== 'admin') {
    const dbUser = await env.DB.prepare(
      'SELECT email_verified FROM users WHERE id = ?'
    ).bind(user.userId).first<{ email_verified: number }>();
    if (dbUser && !dbUser.email_verified) {
      // 检查是否开启了邮箱验证要求
      const emailConfig = await env.DB.prepare(
        'SELECT require_email_verification FROM board_config WHERE id = 1'
      ).first<{ require_email_verification: number }>();
      if (!emailConfig || emailConfig.require_email_verification) {
        return errorResponse(ErrorCode.EMAIL_NOT_VERIFIED, '请先验证邮箱后再留言', 403);
      }
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

  // 获取配置
  const config = await env.DB.prepare(
    'SELECT min_message_length, max_message_length, require_captcha, daily_secret_limit, moderation_enabled, force_skip_turnstile FROM board_config WHERE id = 1'
  ).first<{ min_message_length: number; max_message_length: number; require_captcha: number; daily_secret_limit: number; moderation_enabled: number; force_skip_turnstile: number }>();

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

  // 插入留言
  const result = await env.DB.prepare(
    `INSERT INTO messages (user_id, page_id, page_url, content, is_secret, reply_to, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.userId, body.pageId, body.pageUrl || '', content, body.isSecret ? 1 : 0, body.replyTo || null, status).run();

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
