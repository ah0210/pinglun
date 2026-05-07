// functions/api/v1/admin/cleanup.ts — 手动触发清理
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { logAdminAction } from '../../../../lib/admin-log';
import { successResponse } from '../../../../lib/response';
import type { Env, JwtPayload } from '../../../../lib/types';

export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  // 清理过期验证记录
  const verifResult = await env.DB.prepare(
    "DELETE FROM email_verifications WHERE expires_at < datetime('now') AND verified = 0"
  ).run();

  // 清理过期 Refresh Token
  const tokenResult = await env.DB.prepare(
    "DELETE FROM refresh_tokens WHERE expires_at < datetime('now')"
  ).run();

  // 清理已吊销超过 30 天的 Refresh Token
  const revokedResult = await env.DB.prepare(
    "DELETE FROM refresh_tokens WHERE revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')"
  ).run();

  await logAdminAction(
    env, user!.userId, 'manual_cleanup',
    'system', 0,
    JSON.stringify({
      verifications: verifResult.meta.changes,
      expiredTokens: tokenResult.meta.changes,
      revokedTokens: revokedResult.meta.changes,
    }),
    getClientIp(request)
  );

  return successResponse({
    verificationsDeleted: verifResult.meta.changes,
    expiredTokensDeleted: tokenResult.meta.changes,
    revokedTokensDeleted: revokedResult.meta.changes,
  });
}, { requireAdmin: true });
