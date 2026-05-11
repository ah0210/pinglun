// functions/api/v1/setup.ts — 初始化管理员账号（仅首次部署时可用）
import { apiHandler, getClientIp } from '../../../lib/middleware';
import { hashPassword } from '../../../lib/crypto';
import { getAvatarUrl } from '../../../lib/avatar';
import { sanitizeUsername, sanitizeEmail, validatePasswordStrength } from '../../../lib/sanitize';
import { ErrorCode, errorResponse, successResponse } from '../../../lib/response';
import type { Env } from '../../../lib/types';

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

  // IP 速率限制：同一 IP 5 分钟内最多尝试 3 次
  const ip = getClientIp(request);
  const recentAttempts = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = ? AND created_at > datetime('now', '-5 minutes')"
  ).bind(ip).first<{ count: number }>();
  if (recentAttempts && recentAttempts.count >= 3) {
    return errorResponse(ErrorCode.RATE_LIMITED, '请求过于频繁，请稍后再试', 429);
  }

  // 从环境变量或请求体获取管理员信息（环境变量优先）
  let username: string;
  let email: string;
  let password: string;

  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as { username?: string; email?: string; password?: string };
    // 环境变量优先于请求体，防止请求体覆盖预设凭据
    username = env.ADMIN_USERNAME || body.username || 'admin';
    email = env.ADMIN_EMAIL || body.email || 'admin@example.com';
    password = env.ADMIN_PASSWORD || body.password || '';
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

  // 记录 setup 尝试（用于速率限制）
  await env.DB.prepare(
    "INSERT INTO login_attempts (ip_address, success) VALUES (?, 1)"
  ).bind(ip).run();

  // 标记系统已初始化（不可逆）
  await env.DB.prepare(
    "INSERT OR IGNORE INTO _migrations (name) VALUES ('setup_done')"
  ).run();

  return successResponse({
    message: '管理员账号创建成功',
    admin: { username, email },
  });
}, { requireAuth: false });
