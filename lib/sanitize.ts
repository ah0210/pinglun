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

/** 密码强度校验：8-20 位，包含字母和数字 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return '密码至少 8 个字符';
  }
  if (password.length > 20) {
    return '密码不能超过 20 个字符';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含至少一个数字';
  }
  return null;
}
