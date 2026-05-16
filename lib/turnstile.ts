// lib/turnstile.ts — Cloudflare Turnstile 验证码校验

// Cloudflare 官方测试 Secret Key（本地开发用，注意不是 Site Key）
const PASSING_TEST_SECRET_KEYS = new Set([
  '1x0000000000000000000000000000000AA',
]);

const FAILING_TEST_SECRET_KEYS = new Set([
  '2x0000000000000000000000000000000AA',
  '3x0000000000000000000000000000000AA',
]);

const TEST_SECRET_KEYS = new Set([
  ...PASSING_TEST_SECRET_KEYS,
  ...FAILING_TEST_SECRET_KEYS,
]);

/** 是否为 Cloudflare 官方测试密钥（本地开发环境） */
export function isTestKey(secretKey: string): boolean {
  return TEST_SECRET_KEYS.has(secretKey.trim());
}

/** Turnstile 是否已配置 secretKey（测试密钥也算已配置） */
export function isTurnstileConfigured(secretKey: string): boolean {
  return !!secretKey.trim();
}

/**
 * 检查是否应该跳过 Turnstile 验证
 * - forceSkipTurnstile 开关打开 → 跳过（紧急降级，由管理员在后台开启）
 */
export function shouldSkipTurnstile(_secretKey: string, forceSkip?: boolean): boolean {
  return forceSkip === true;
}

/**
 * 向 Cloudflare Turnstile siteverify API 验证 token
 * @param token - 前端 Turnstile 回调返回的 token
 * @param secretKey - Turnstile Secret Key
 * @param remoteIp - 用户真实 IP（通过 CF-Connecting-IP 获取，增强风控精度）
 * @returns true=验证通过，false=验证失败
 */
export async function verifyTurnstile(token: string, secretKey: string, remoteIp?: string): Promise<boolean> {
  const normalizedSecret = secretKey.trim();

  if (!normalizedSecret) {
    console.error('Turnstile verification skipped: TURNSTILE_SECRET_KEY is not configured');
    return false;
  }

  if (PASSING_TEST_SECRET_KEYS.has(normalizedSecret)) {
    return true;
  }
  if (FAILING_TEST_SECRET_KEYS.has(normalizedSecret)) {
    return false;
  }

  const body: Record<string, string> = {
    secret: normalizedSecret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  };
  if (remoteIp) body.remoteip = remoteIp;

  /**
   * 最多重试 2 次（共 3 次尝试）
   * Cloudflare siteverify 偶尔网络超时，重试可覆盖临时故障
   */
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(body).toString(),
      });

      const data = await resp.json() as {
        success: boolean;
        'error-codes'?: string[];
        hostname?: string;
        action?: string;
      };
      if (data.success === true) return true;

      // 验证明确失败（非网络错误），不需要重试
      console.warn('Turnstile verification failed:', {
        errorCodes: data['error-codes'] || [],
        hostname: data.hostname,
        action: data.action,
      });
      return false;
    } catch (error) {
      console.error(`Turnstile verification error (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      if (attempt < maxRetries) {
        // 短暂等待后重试
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      return false;
    }
  }
  return false;
}
