// functions/api/v1/auth/change-email.ts — 修改邮箱
import { apiHandler } from '../../../../lib/middleware';
import { verifyPassword } from '../../../../lib/crypto';
import { sendEmail, buildVerifyEmailHtml } from '../../../../lib/email';
import { generateToken, hashToken } from '../../../../lib/jwt';
import { getAvatarUrl } from '../../../../lib/avatar';
import { sanitizeEmail } from '../../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env, DbUser, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const body = await request.json() as { newEmail?: string; currentPassword?: string };

  if (!body.newEmail || !body.currentPassword) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请填写新邮箱和当前密码', 400);
  }

  const newEmail = sanitizeEmail(body.newEmail);

  // 验证邮箱格式
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '邮箱格式不正确', 400);
  }

  // 获取当前用户
  const dbUser = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(user!.userId).first<DbUser>();

  if (!dbUser) {
    return errorResponse(ErrorCode.USER_NOT_FOUND, '用户不存在', 404);
  }

  // 验证当前密码
  const valid = await verifyPassword(body.currentPassword, dbUser.password_hash);
  if (!valid) {
    return errorResponse(ErrorCode.WRONG_PASSWORD, '当前密码错误', 400);
  }

  // 检查新邮箱是否已被占用
  if (newEmail !== dbUser.email) {
    const existing = await env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND id != ?'
    ).bind(newEmail, user!.userId).first();
    if (existing) {
      return errorResponse(ErrorCode.EMAIL_TAKEN, '该邮箱已被其他账号使用', 409);
    }
  } else {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '新邮箱不能与当前邮箱相同', 400);
  }

  // 更新邮箱 + 重置验证状态 + 更新头像（Gravatar 基于 email）
  const newAvatar = getAvatarUrl(newEmail);
  await env.DB.prepare(
    'UPDATE users SET email = ?, email_verified = 0, avatar = ?, updated_at = datetime("now") WHERE id = ?'
  ).bind(newEmail, newAvatar, user!.userId).run();

  // 清除旧的未使用验证记录，避免混淆
  await env.DB.prepare(
    'DELETE FROM email_verifications WHERE user_id = ? AND verified = 0'
  ).bind(user!.userId).run();

  // 生成验证 token
  const verifyToken = generateToken();
  const verifyTokenHash = await hashToken(verifyToken);
  const verifyExpires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO email_verifications (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(user!.userId, verifyTokenHash, verifyExpires).run();

  // 发送验证邮件（异步）
  const verifyUrl = `${env.PUBLIC_URL}/api/v1/auth/verify-email?token=${verifyToken}`;
  const html = buildVerifyEmailHtml(dbUser.username, verifyUrl);
  sendEmail({ to: newEmail, subject: '请验证您的新邮箱', html }, env).catch(() => {});

  // 获取更新后的用户信息
  const updatedUser = await env.DB.prepare(
    'SELECT * FROM users WHERE id = ?'
  ).bind(user!.userId).first<DbUser>();

  return successResponse({
    message: '邮箱已修改，请验证新邮箱',
    user: {
      id: updatedUser!.id,
      username: updatedUser!.username,
      displayName: updatedUser!.display_name || updatedUser!.username,
      email: updatedUser!.email,
      emailVerified: updatedUser!.email_verified === 1,
      avatar: updatedUser!.avatar,
      role: updatedUser!.role,
      bio: updatedUser!.bio,
    },
  });
}, { requireAuth: true });
