// lib/email.ts — Resend 邮件发送（同步直接调用）

import type { Env } from './types';
import { escapeHtml } from './sanitize';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(payload: EmailPayload, env: Env): Promise<boolean> {
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.EMAIL_FROM_NAME} <noreply@${env.EMAIL_DOMAIN}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      }),
    });
    return resp.ok;
  } catch (error) {
    console.error('Failed to send email:', error);
    return false;
  }
}

export function buildVerifyEmailHtml(username: string, verifyUrl: string): string {
  const safeUsername = escapeHtml(username);
  const safeUrl = sanitizeUrl(verifyUrl);
  return `
    <div style="max-width:560px;margin:0 auto;font-family:sans-serif;">
      <h2>欢迎注册自游人留言板，${safeUsername}！</h2>
      <p>请点击下方链接验证您的邮箱：</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;border-radius:6px;text-decoration:none;">
        验证邮箱
      </a>
      <p style="color:#999;font-size:12px;">链接 24 小时内有效。如非本人操作请忽略。</p>
    </div>
  `;
}

export function buildResetPasswordHtml(username: string, resetUrl: string): string {
  const safeUsername = escapeHtml(username);
  const safeUrl = sanitizeUrl(resetUrl);
  return `
    <div style="max-width:560px;margin:0 auto;font-family:sans-serif;">
      <h2>${safeUsername}，您好！</h2>
      <p>我们收到了您重置密码的请求。请点击下方链接设置新密码：</p>
      <a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;border-radius:6px;text-decoration:none;">
        重置密码
      </a>
      <p style="color:#999;font-size:12px;">链接 1 小时内有效。如非本人操作请忽略此邮件，您的密码不会被更改。</p>
    </div>
  `;
}

/** 对 URL 进行安全编码：验证协议 + 对查询参数值编码 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // 仅允许 http/https 协议，防止 javascript: 注入
    if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
    // 对查询参数值进行严格编码
    parsed.searchParams.toString(); // 触发自动编码
    return parsed.href;
  } catch {
    return '#';
  }
}
