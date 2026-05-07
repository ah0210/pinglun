// functions/api/v1/config.ts — 留言板公开配置
import { apiHandler } from '../../../../lib/middleware';
import { successResponse } from '../../../../lib/response';
import { cacheHeaders } from '../../../../lib/cache-headers';
import type { Env, DbBoardConfig } from '../../../../lib/types';

export const onRequestGet = apiHandler(async (request, env) => {
  const config = await env.DB.prepare(
    'SELECT site_name, max_message_length, require_captcha, moderation_enabled, daily_secret_limit, allow_registration FROM board_config WHERE id = 1'
  ).first();

  if (!config) {
    return successResponse({
      siteName: '留言板',
      maxMessageLength: 500,
      requireCaptcha: true,
      moderationEnabled: false,
      dailySecretLimit: 5,
      allowRegistration: true,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    }, cacheHeaders(300));
  }

  const c = config as DbBoardConfig;
  return successResponse({
    siteName: c.site_name,
    maxMessageLength: c.max_message_length,
    requireCaptcha: c.require_captcha === 1,
    moderationEnabled: c.moderation_enabled === 1,
    dailySecretLimit: c.daily_secret_limit,
    allowRegistration: c.allow_registration === 1,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
  }, cacheHeaders(300));
}, { requireAuth: false });
