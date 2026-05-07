-- ============================================
-- 种子数据 — 留言板默认配置
-- 管理员账号通过 POST /api/v1/setup 创建
-- ============================================

-- 初始化默认配置
INSERT OR IGNORE INTO board_config (id, site_name, max_message_length, require_captcha, moderation_enabled, daily_secret_limit, allow_registration)
VALUES (1, '自游人留言板', 500, 1, 0, 5, 1);
