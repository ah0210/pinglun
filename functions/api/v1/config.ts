// functions/api/v1/config.ts — 留言板公开配置
import { apiHandler } from '../../../lib/middleware';
import { successResponse } from '../../../lib/response';
import { cacheHeaders } from '../../../lib/cache-headers';
import type { Env, DbBoardConfig } from '../../../lib/types';

export const onRequestGet = apiHandler(async (request, env) => {
  const config = await env.DB.prepare(
    'SELECT site_name, min_message_length, max_message_length, require_captcha, moderation_enabled, daily_secret_limit, allow_registration, require_email_verification, force_skip_turnstile FROM board_config WHERE id = 1'
  ).first<DbBoardConfig>();

  if (!config) {
    return successResponse({
      siteName: '留言板',
      minMessageLength: 2,
      maxMessageLength: 500,
      requireCaptcha: true,
      moderationEnabled: false,
      dailySecretLimit: 5,
      allowRegistration: true,
      requireEmailVerification: true,
      forceSkipTurnstile: false,
      turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
    }, cacheHeaders(300));
  }

  const c = config;
  return successResponse({
    siteName: c.site_name,
    minMessageLength: c.min_message_length || 2,
    maxMessageLength: c.max_message_length,
    requireCaptcha: c.require_captcha === 1,
    moderationEnabled: c.moderation_enabled === 1,
    dailySecretLimit: c.daily_secret_limit,
    allowRegistration: c.allow_registration === 1,
    requireEmailVerification: c.require_email_verification === 1,
    forceSkipTurnstile: c.force_skip_turnstile === 1,
    turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
  }, cacheHeaders(300));
}, { requireAuth: false });
