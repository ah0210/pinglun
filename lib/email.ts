// lib/email.ts — Resend 邮件发送（同步直接调用）

import type { Env } from './types';

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
  return `
    <div style="max-width:560px;margin:0 auto;font-family:sans-serif;">
      <h2>欢迎注册自游人留言板，${username}！</h2>
      <p>请点击下方链接验证您的邮箱：</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:#fff;border-radius:6px;text-decoration:none;">
        验证邮箱
      </a>
      <p style="color:#999;font-size:12px;">链接 24 小时内有效。如非本人操作请忽略。</p>
    </div>
  `;
}
