// functions/api/v1/admin/config.ts — 系统配置管理
import { apiHandler, getClientIp } from '../../../../lib/middleware';
import { logAdminAction } from '../../../../lib/admin-log';
import { successResponse, errorResponse, ErrorCode } from '../../../../lib/response';
import { noCacheHeaders } from '../../../../lib/cache-headers';
import type { Env, DbBoardConfig, JwtPayload } from '../../../../lib/types';

// GET — 获取系统配置
export const onRequestGet = apiHandler(async (request, env) => {
  const config = await env.DB.prepare('SELECT * FROM board_config WHERE id = 1').first<DbBoardConfig>();

  if (!config) {
    return successResponse({}, noCacheHeaders());
  }

  return successResponse({
    siteName: config.site_name,
    minMessageLength: config.min_message_length || 2,
    maxMessageLength: config.max_message_length,
    requireCaptcha: config.require_captcha === 1,
    moderationEnabled: config.moderation_enabled === 1,
    dailySecretLimit: config.daily_secret_limit,
    allowRegistration: config.allow_registration === 1,
    updatedAt: config.updated_at,
  }, noCacheHeaders());
}, { requireAdmin: true });

// POST — 更新系统配置
export const onRequestPost = apiHandler(async (request, env, ctx, user) => {
  const body = await request.json() as {
    siteName?: string;
    minMessageLength?: number;
    maxMessageLength?: number;
    requireCaptcha?: boolean;
    moderationEnabled?: boolean;
    dailySecretLimit?: number;
    allowRegistration?: boolean;
  };

  const updates: string[] = [];
  const binds: unknown[] = [];

  if (body.siteName !== undefined) {
    updates.push('site_name = ?');
    binds.push(body.siteName.slice(0, 50));
  }
  if (body.minMessageLength !== undefined) {
    updates.push('min_message_length = ?');
    binds.push(Math.min(Math.max(body.minMessageLength, 1), 50));
  }
  if (body.maxMessageLength !== undefined) {
    updates.push('max_message_length = ?');
    binds.push(Math.min(Math.max(body.maxMessageLength, 100), 5000));
  }
  if (body.requireCaptcha !== undefined) {
    updates.push('require_captcha = ?');
    binds.push(body.requireCaptcha ? 1 : 0);
  }
  if (body.moderationEnabled !== undefined) {
    updates.push('moderation_enabled = ?');
    binds.push(body.moderationEnabled ? 1 : 0);
  }
  if (body.dailySecretLimit !== undefined) {
    updates.push('daily_secret_limit = ?');
    binds.push(body.dailySecretLimit);
  }
  if (body.allowRegistration !== undefined) {
    updates.push('allow_registration = ?');
    binds.push(body.allowRegistration ? 1 : 0);
  }

  if (updates.length === 0) {
    return errorResponse(ErrorCode.VALIDATION_ERROR, '没有要更新的字段', 400);
  }

  updates.push('updated_at = datetime("now")');

  await env.DB.prepare(
    `UPDATE board_config SET ${updates.join(', ')} WHERE id = 1`
  ).bind(...binds).run();

  await logAdminAction(
    env, user!.userId, 'update_config',
    'config', 1,
    JSON.stringify(body),
    getClientIp(request)
  );

  return successResponse({ message: '配置已更新' });
}, { requireAdmin: true });
