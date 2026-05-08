// functions/api/v1/messages/index.ts — 留言列表 + 提交留言
import { apiHandler } from '../../../../lib/middleware';
import { verifyTurnstile } from '../../../../lib/turnstile';
import { escapeHtml } from '../../../../lib/sanitize';
import { cacheHeaders, noCacheHeaders } from '../../../../lib/cache-headers';
import { ErrorCode, errorResponse, successResponse, paginatedResponse } from '../../../../lib/response';
import { toPublicUser } from '../../../../lib/types';
import { getAvatarUrl } from '../../../../lib/avatar';
import type { DbMessage } from '../../../../lib/types';

// GET — 留言列表（公开，CDN 缓存 60s，秘密留言按权限过滤）
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const url = new URL(request.url);
  const pageId = url.searchParams.get('pageId') || '';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 50);

  // 构建查询条件
  let whereClause = 'WHERE m.page_id = ? AND m.status = ?';
  const binds: unknown[] = [pageId, 'approved'];

  if (!user) {
    // 未登录：只看公开留言
    whereClause += ' AND m.is_secret = 0';
  } else if (user.role !== 'admin') {
    // 普通用户：公开留言 + 自己的秘密留言
    whereClause += ` AND (m.is_secret = 0 OR (m.is_secret = 1 AND m.user_id = ?))`;
    binds.push(user.userId);
  }
  // 管理员：看所有留言

  // 计算总数
  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM messages m ${whereClause}`
  ).bind(...binds).first<{ total: number }>();

  const total = countResult?.total || 0;

  // 获取留言列表
  const messages = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.email, u.role as user_role, u.bio
     FROM messages m
     JOIN users u ON m.user_id = u.id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds, limit, (page - 1) * limit).all<DbMessage & { username: string; display_name: string; avatar: string; email: string; user_role: string; bio: string }>();

  // 利用已获取的 total 避免重复查询

  // 处理秘密留言内容
  const items = (messages.results || []).map(m => {
    const publicUser: ReturnType<typeof toPublicUser> = {
      id: m.user_id,
      username: m.username,
      displayName: m.display_name || m.username,
      avatar: m.avatar || getAvatarUrl(m.email),
      role: m.user_role,
      bio: m.bio,
    };

    let content = m.content;

    // 非管理员看到他人的秘密留言时替换内容
    if (m.is_secret === 1 && user && user.role !== 'admin' && m.user_id !== user.userId) {
      content = '[这是一条秘密留言]';
    }

    return {
      id: m.id,
      pageId: m.page_id,
      content,
      isSecret: m.is_secret === 1,
      status: m.status,
      replyTo: m.reply_to,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
      user: publicUser,
    };
  });

  const headers = { ...cacheHeaders(60), ...{ 'Content-Type': 'application/json' } };
  return paginatedResponse(items, total, page, limit, headers);
}, { requireAuth: false });

// POST — 提交留言（需登录）
export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  if (!user) {
    return errorResponse(ErrorCode.UNAUTHORIZED, '请先登录', 401);
  }

  const body = await request.json() as {
    content: string;
    pageId: string;
    isSecret?: boolean;
    turnstileToken?: string;
  };

  if (!body.content || !body.pageId) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写留言内容和页面ID', 400);
  }

  // 获取配置
  const config = await env.DB.prepare(
    'SELECT max_message_length, require_captcha, daily_secret_limit, moderation_enabled FROM board_config WHERE id = 1'
  ).first<{ max_message_length: number; require_captcha: number; daily_secret_limit: number; moderation_enabled: number }>();

  const maxLength = config?.max_message_length || 500;

  // 验证留言长度
  if (body.content.length > maxLength) {
    return errorResponse(ErrorCode.MESSAGE_TOO_LONG, `留言不能超过 ${maxLength} 字`, 400);
  }

  // 验证码检查
  if (config?.require_captcha) {
    if (!body.turnstileToken) {
      return errorResponse(ErrorCode.VALIDATION_ERROR, '请完成验证码验证', 400);
    }
    const valid = await verifyTurnstile(body.turnstileToken, env.TURNSTILE_SECRET_KEY);
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
    `INSERT INTO messages (user_id, page_id, content, is_secret, status) VALUES (?, ?, ?, ?, ?)`
  ).bind(user.userId, body.pageId, content, body.isSecret ? 1 : 0, status).run();

  return successResponse({
    id: result.meta.last_row_id,
    content,
    pageId: body.pageId,
    isSecret: !!body.isSecret,
    status,
    message: status === 'pending' ? '留言已提交，等待审核' : '留言发布成功',
  }, noCacheHeaders());
}, { requireAuth: true });
