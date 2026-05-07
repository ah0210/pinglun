// functions/api/v1/messages/[id].ts — 单条留言详情
import { apiHandler } from '../../../../lib/middleware';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import { getAvatarUrl } from '../../../../lib/avatar';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import type { Env, DbMessage, DbUser, JwtPayload } from '../../../../lib/types';

// GET — 单条留言
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const id = ctx.params.id;

  const message = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.email, u.role as user_role, u.bio
     FROM messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.id = ?`
  ).bind(id).first<DbMessage & { username: string; display_name: string; avatar: string; email: string; user_role: string; bio: string }>();

  if (!message) {
    return errorResponse(ErrorCode.MESSAGE_NOT_FOUND, '留言不存在', 404);
  }

  // 秘密留言权限检查
  if (message.is_secret === 1) {
    if (!user) {
      return errorResponse(ErrorCode.UNAUTHORIZED, '请先登录', 401);
    }
    if (user.role !== 'admin' && message.user_id !== user.userId) {
      return errorResponse(ErrorCode.FORBIDDEN, '无权查看此留言', 403);
    }
  }

  // 非审核通过的秘密留言只有管理员可见
  if (message.status !== 'approved' && user?.role !== 'admin') {
    return errorResponse(ErrorCode.MESSAGE_NOT_FOUND, '留言不存在', 404);
  }

  let content = message.content;
  if (message.is_secret === 1 && user && user.role !== 'admin' && message.user_id !== user.userId) {
    content = '[这是一条秘密留言]';
  }

  return successResponse({
    id: message.id,
    pageId: message.page_id,
    content,
    isSecret: message.is_secret === 1,
    status: message.status,
    replyTo: message.reply_to,
    createdAt: message.created_at,
    updatedAt: message.updated_at,
    user: {
      id: message.user_id,
      username: message.username,
      displayName: message.display_name || message.username,
      avatar: message.avatar || getAvatarUrl(message.email),
      role: message.user_role,
      bio: message.bio,
    },
  }, noCacheHeaders());
}, { requireAuth: false });
