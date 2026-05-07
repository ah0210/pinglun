// functions/api/v1/setup.ts — 初始化管理员账号（仅首次部署时可用）
import { apiHandler } from '../../../../lib/middleware';
import { hashPassword } from '../../../../lib/crypto';
import { getAvatarUrl } from '../../../../lib/avatar';
import { sanitizeUsername, sanitizeEmail } from '../../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../../lib/response';
import type { Env } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env) => {
  // 检查是否已有管理员
  const adminCount = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
  ).first<{ count: number }>();

  if (adminCount && adminCount.count > 0) {
    return errorResponse(ErrorCode.SETUP_ALREADY_DONE, '管理员账号已初始化', 403);
  }

  // 从环境变量或请求体获取管理员信息
  let username: string;
  let email: string;
  let password: string;

  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as { username?: string; email?: string; password?: string };
    username = body.username || env.ADMIN_USERNAME || 'admin';
    email = body.email || env.ADMIN_EMAIL || 'admin@example.com';
    password = body.password || env.ADMIN_PASSWORD || 'admin123456';
  } else {
    username = env.ADMIN_USERNAME || 'admin';
    email = env.ADMIN_EMAIL || 'admin@example.com';
    password = env.ADMIN_PASSWORD || 'admin123456';
  }

  username = sanitizeUsername(username);
  email = sanitizeEmail(email);

  // 创建管理员
  const passwordHash = await hashPassword(password);
  const avatar = getAvatarUrl(email);

  await env.DB.prepare(
    `INSERT INTO users (username, email, password_hash, role, avatar, email_verified)
     VALUES (?, ?, ?, 'admin', ?, 1)`
  ).bind(username, email, passwordHash, avatar).run();

  return successResponse({
    message: '管理员账号创建成功',
    admin: { username, email },
  });
}, { requireAuth: false });
