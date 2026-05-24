// functions/api/v1/messages/[id].ts — 单条留言详情
import { apiHandler } from '../../../../lib/middleware';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import type { Env, DbMessage, DbUser, JwtPayload } from '../../../../lib/types';

// GET — 单条留言
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const id = ctx.params.id;

  // 不获取 u.email，避免邮箱数据泄露风险；avatar 在注册时已生成完整 URL
  const message = await env.DB.prepare(
    `SELECT m.*, u.username, u.display_name, u.avatar, u.role as user_role, u.bio
     FROM messages m
     JOIN users u ON m.user_id = u.id
     WHERE m.id = ?`
  ).bind(id).first<DbMessage & { username: string; display_name: string; avatar: string; user_role: string; bio: string }>();

  if (!message) {
    return errorResponse(ErrorCode.MESSAGE_NOT_FOUND, '留言不存在', 404);
  }

  let content = message.content;
  if (user?.role !== 'admin' && message.status !== 'approved') {
    content = message.status === 'pending' ? '⏳ 留言正在审核中' : '🚫 留言未通过审核';
  } else if (message.is_secret === 1 && (!user || (user.role !== 'admin' && message.user_id !== user.userId))) {
    content = '🔒 这是一条秘密留言';
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
      avatar: message.avatar,  // avatar 在注册时已生成完整 URL，无需 email
      role: message.user_role,
      bio: message.bio,
    },
  }, noCacheHeaders());
}, { requireAuth: false });
