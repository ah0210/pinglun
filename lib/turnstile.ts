// lib/turnstile.ts — Cloudflare Turnstile 验证码校验

// Cloudflare 官方测试密钥（本地开发用）
const TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA', // 强制交互式挑战
  '2x00000000000000000000AB',            // 始终通过
  '3x00000000000000000000AB',            // 始终失败
]);

/** 是否为 Cloudflare 官方测试密钥（本地开发环境） */
export function isTestKey(secretKey: string): boolean {
  return TEST_SECRET_KEYS.has(secretKey);
}

/** Turnstile 是否已配置（secretKey 非空且非测试密钥） */
export function isTurnstileConfigured(secretKey: string): boolean {
  return !!secretKey && !TEST_SECRET_KEYS.has(secretKey);
}

export async function verifyTurnstile(token: string, secretKey: string, remoteIp?: string): Promise<boolean> {
  // 未配置 secret key 或使用测试密钥时自动通过
  if (!secretKey || TEST_SECRET_KEYS.has(secretKey)) {
    return true;
  }

  try {
    const body: Record<string, string> = {
      secret: secretKey,
      response: token,
    };
    if (remoteIp) body.remoteip = remoteIp;

    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });

    const data = await resp.json() as { success: boolean };
    return data.success === true;
  } catch (error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}
