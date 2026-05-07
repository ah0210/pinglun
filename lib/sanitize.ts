// lib/sanitize.ts — XSS 防护（HTML 转义 + 用户名清理）

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function sanitizeUsername(str: string): string {
  return str.replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '').slice(0, 30);
}

export function sanitizeEmail(str: string): string {
  return str.trim().toLowerCase().slice(0, 254);
}
