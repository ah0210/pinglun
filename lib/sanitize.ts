// lib/sanitize.ts — XSS 防护（HTML 转义 + 用户名清理）

/** 密码最大长度（与 crypto.ts 共享，防止哈希截断与验证长度不一致） */
export const MAX_PASSWORD_LENGTH = 20;

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

/** 中国手机号格式验证：1开头，第二位3-9，共11位纯数字 */
export function validatePhone(phone: string): string | null {
  if (!phone || !phone.trim()) {
    return '请填写手机号';
  }
  if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
    return '手机号格式不正确（需为中国大陆11位手机号）';
  }
  return null;
}

/** 邮箱格式严格验证 */
export function validateEmail(email: string): string | null {
  if (!email || !email.trim()) {
    return '请填写邮箱';
  }
  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return '邮箱地址过长';
  }
  // RFC 5322 简化版：要求 @ 前后均有内容，域名至少一个点
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return '邮箱格式不正确';
  }
  return null;
}

/** 密码强度校验：8-MAX_PASSWORD_LENGTH 位，包含字母和数字 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return '密码至少 8 个字符';
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `密码不能超过 ${MAX_PASSWORD_LENGTH} 个字符`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含至少一个字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含至少一个数字';
  }
  return null;
}
