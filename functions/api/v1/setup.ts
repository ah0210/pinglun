// functions/api/v1/setup.ts — 初始化管理员账号（仅首次部署时可用）
import { apiHandler } from '../../../lib/middleware';
import { hashPassword } from '../../../lib/crypto';
import { getAvatarUrl } from '../../../lib/avatar';
import { sanitizeUsername, sanitizeEmail } from '../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../lib/response';
import type { Env } from '../../../lib/types';

/** 密码强度校验：至少 8 位，包含字母和数字 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return '密码至少 8 个字符';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含至少一个数字';
  }
  return null;
}

export const onRequestPost = apiHandler(async (request, env) => {
  // 检查是否已完成初始化（不可逆标记，记录在 _migrations 中）
  const setupDone = await env.DB.prepare(
    "SELECT name FROM _migrations WHERE name = 'setup_done'"
  ).first<{ name: string }>();
  if (setupDone) {
    return errorResponse(ErrorCode.SETUP_ALREADY_DONE, '系统已初始化，不可重复操作', 403);
  }

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
    password = body.password || env.ADMIN_PASSWORD || '';
  } else {
    username = env.ADMIN_USERNAME || 'admin';
    email = env.ADMIN_EMAIL || 'admin@example.com';
    password = env.ADMIN_PASSWORD || '';
  }

  if (!password) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '请设置管理员密码（通过请求体或 ADMIN_PASSWORD 环境变量）', 400);
  }

  // 密码强度校验
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, passwordError, 400);
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

  // 标记系统已初始化（不可逆）
  await env.DB.prepare(
    "INSERT OR IGNORE INTO _migrations (name) VALUES ('setup_done')"
  ).run();

  return successResponse({
    message: '管理员账号创建成功',
    admin: { username, email },
  });
}, { requireAuth: false });
