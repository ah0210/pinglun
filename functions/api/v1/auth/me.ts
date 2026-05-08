// functions/api/v1/auth/me.ts — 当前用户信息 / 修改资料
import { apiHandler } from '../../../../lib/middleware';
import { getAvatarUrl } from '../../../../lib/avatar';
import { escapeHtml, sanitizeUsername } from '../../../../lib/sanitize';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import type { DbUser } from '../../../../lib/types';

// GET — 获取当前用户信息
export const onRequestGet = apiHandler(async (request, env, ctx, user) => {
  const dbUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user!.userId).first<DbUser>();

  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
  }

  return successResponse({
    id: dbUser.id,
    username: dbUser.username,
    displayName: dbUser.display_name || dbUser.username,
    email: dbUser.email,
    avatar: dbUser.avatar || getAvatarUrl(dbUser.email),
    role: dbUser.role,
    bio: dbUser.bio,
    emailVerified: dbUser.email_verified === 1,
    createdAt: dbUser.created_at,
  });
}, { requireAuth: true });

// PATCH — 修改个人信息
export const onRequestPatch = apiHandler(async (request, env, ctx, user) => {
  const body = await request.json() as { displayName?: string; bio?: string };

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.displayName !== undefined) {
    const displayName = sanitizeUsername(body.displayName);
    updates.push('display_name = ?');
    values.push(displayName);
  }

  if (body.bio !== undefined) {
    updates.push('bio = ?');
    values.push(escapeHtml(body.bio.slice(0, 200)));
  }

  if (updates.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '没有要更新的字段', 400);
  }

  updates.push('updated_at = datetime("now")');
  values.push(user!.userId);

  await env.DB.prepare(
    `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const updatedUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user!.userId).first<DbUser>();

  return successResponse({
    id: updatedUser!.id,
    username: updatedUser!.username,
    displayName: updatedUser!.display_name || updatedUser!.username,
    email: updatedUser!.email,
    avatar: updatedUser!.avatar || getAvatarUrl(updatedUser!.email),
    role: updatedUser!.role,
    bio: updatedUser!.bio,
  });
}, { requireAuth: true });
