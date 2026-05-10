// functions/api/v1/auth/verify-email.ts — 邮箱验证确认
import { apiHandler } from '../../../../lib/middleware';
import { hashToken } from '../../../../lib/jwt';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import { escapeHtml } from '../../../../lib/sanitize';
import type { Env, DbVerification } from '../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '缺少验证 token', 400);
  }

  // 哈希 token 后查找验证记录（与 refresh_tokens 一致的安全策略）
  const tokenHash = await hashToken(token);
  const verification = await env.DB.prepare(
    'SELECT * FROM email_verifications WHERE token = ?'
  ).bind(tokenHash).first<DbVerification>();

  if (!verification) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '验证链接无效', 400);
  }

  if (verification.verified) {
    // 已验证，返回 HTML 成功页
    return new Response(buildVerifyResultHtml('邮箱已验证', '您的邮箱已完成验证，可以正常使用留言功能。'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 检查是否过期
  if (new Date(verification.expires_at) < new Date()) {
    return new Response(buildVerifyResultHtml('验证链接已过期', '请重新发送验证邮件。', true), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 标记为已验证
  await env.DB.prepare(
    'UPDATE email_verifications SET verified = 1 WHERE id = ?'
  ).bind(verification.id).run();

  // 更新用户邮箱验证状态
  await env.DB.prepare(
    'UPDATE users SET email_verified = 1 WHERE id = ?'
  ).bind(verification.user_id).run();

  return new Response(buildVerifyResultHtml('邮箱验证成功', '您的邮箱已完成验证，现在可以正常使用留言功能。'), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}, { requireAuth: false });

function buildVerifyResultHtml(title: string, message: string, expired = false): string {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f7f8fa; color: #333; }
    .card { background: #fff; border-radius: 12px; padding: 40px; max-width: 420px; width: 90%; box-shadow: 0 2px 12px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { color: #666; line-height: 1.6; margin: 0 0 24px; }
    .icon { font-size: 48px; margin-bottom: 16px; }
    a { display: inline-block; padding: 10px 24px; background: #4a6cf7; color: #fff; border-radius: 6px; text-decoration: none; font-size: 14px; }
    a:hover { background: #3b5de7; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${expired ? '⏰' : '✅'}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="javascript:window.close()">关闭页面</a>
  </div>
</body>
</html>`;
}
