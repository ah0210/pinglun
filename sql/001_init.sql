-- ============================================
-- 自游人留言板 完整 Schema (D1 / SQLite) v1.0.0
-- 包含所有表结构、字段和索引
-- 新部署只需执行此文件 + 002_seed.sql
-- ============================================

-- Schema 迁移记录表
CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT UNIQUE NOT NULL,
  display_name    TEXT DEFAULT '',
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT DEFAULT '' UNIQUE,
  email_verified  INTEGER DEFAULT 0,
  email_verified_at TEXT DEFAULT NULL,
  password_hash   TEXT NOT NULL,
  role            TEXT DEFAULT 'user',
  avatar          TEXT DEFAULT '',
  bio             TEXT DEFAULT '',
  vip_level       INTEGER DEFAULT 0,
  vip_expires_at  TEXT DEFAULT NULL,
  status          TEXT DEFAULT 'active',
  last_login_at   TEXT DEFAULT NULL,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- 邮箱验证表
CREATE TABLE IF NOT EXISTS email_verifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  verified   INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 密码重置表
CREATE TABLE IF NOT EXISTS password_resets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  used       INTEGER DEFAULT 0,
  ip_address TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 留言表
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id    TEXT NOT NULL DEFAULT '',
  page_url   TEXT DEFAULT '',
  content    TEXT NOT NULL,
  is_secret  INTEGER DEFAULT 0,
  status     TEXT DEFAULT 'approved',
  reply_to   INTEGER DEFAULT NULL,
  ip_address TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT NULL
);

-- 留言板配置表（单行配置）
CREATE TABLE IF NOT EXISTS board_config (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  site_name                 TEXT DEFAULT '留言板',
  min_message_length        INTEGER DEFAULT 2,
  max_message_length        INTEGER DEFAULT 500,
  require_captcha           INTEGER DEFAULT 1,
  moderation_enabled        INTEGER DEFAULT 0,
  daily_secret_limit        INTEGER DEFAULT 5,
  allow_registration        INTEGER DEFAULT 1,
  require_email_verification INTEGER DEFAULT 1,
  force_skip_turnstile      INTEGER DEFAULT 0,
  analytics_enabled         INTEGER DEFAULT 1,
  show_view_count           INTEGER DEFAULT 1,
  updated_at                TEXT DEFAULT (datetime('now'))
);

-- 管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id    INTEGER NOT NULL REFERENCES users(id),
  action      TEXT NOT NULL,
  target_type TEXT DEFAULT '',
  target_id   INTEGER,
  detail      TEXT DEFAULT '',
  ip_address  TEXT DEFAULT '',
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Refresh Token 表（双 Token 认证）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT UNIQUE NOT NULL,
  expires_at  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now')),
  revoked_at  TEXT DEFAULT NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_page ON messages(page_id);
CREATE INDEX IF NOT EXISTS idx_messages_page_created ON messages(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_secret ON messages(is_secret);
CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(reply_to);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_page_status ON messages(page_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_verifications_expires ON email_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

-- 登录失败记录表（替代内存 Map，支持多边缘节点分布式限流）
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  success    INTEGER NOT NULL DEFAULT 0,  -- 0=失败, 1=成功
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at);

-- OAuth 第三方账号绑定表
CREATE TABLE IF NOT EXISTS oauth_connections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_uid  TEXT NOT NULL,
  access_token  TEXT DEFAULT '',
  token_expires TEXT DEFAULT NULL,
  provider_info TEXT DEFAULT '',
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now')),
  UNIQUE(provider, provider_uid)
);

CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_provider_uid ON oauth_connections(provider, provider_uid);

-- 流量统计原始事件表
CREATE TABLE IF NOT EXISTS analytics_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id         TEXT NOT NULL,
  page_title      TEXT DEFAULT '',
  page_url        TEXT DEFAULT '',
  canonical_url   TEXT DEFAULT '',
  referrer        TEXT DEFAULT '',
  referrer_domain TEXT DEFAULT '',
  utm_source      TEXT DEFAULT '',
  utm_medium      TEXT DEFAULT '',
  utm_campaign    TEXT DEFAULT '',
  channel         TEXT DEFAULT 'direct',
  country         TEXT DEFAULT '',
  device_type     TEXT DEFAULT '',
  screen_width    INTEGER DEFAULT 0,
  screen_height   INTEGER DEFAULT 0,
  viewport_width  INTEGER DEFAULT 0,
  viewport_height INTEGER DEFAULT 0,
  language        TEXT DEFAULT '',
  timezone        TEXT DEFAULT '',
  ip_address      TEXT DEFAULT '',
  visitor_id      TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- 页面每日聚合统计表
CREATE TABLE IF NOT EXISTS analytics_page_daily (
  date            TEXT NOT NULL,
  page_id         TEXT NOT NULL,
  page_title      TEXT DEFAULT '',
  page_url        TEXT DEFAULT '',
  canonical_url   TEXT DEFAULT '',
  views           INTEGER DEFAULT 0,
  visitors        INTEGER DEFAULT 0,
  sessions        INTEGER DEFAULT 0,
  search_views    INTEGER DEFAULT 0,
  internal_views  INTEGER DEFAULT 0,
  direct_views    INTEGER DEFAULT 0,
  referral_views  INTEGER DEFAULT 0,
  social_views    INTEGER DEFAULT 0,
  message_count   INTEGER DEFAULT 0,
  countries_json  TEXT DEFAULT '{}',
  channels_json   TEXT DEFAULT '{}',
  devices_json    TEXT DEFAULT '{}',
  updated_at      TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (date, page_id)
);

-- 页面累计统计表，供前台快速读取浏览量和留言数
CREATE TABLE IF NOT EXISTS analytics_page_totals (
  page_id         TEXT PRIMARY KEY,
  page_title      TEXT DEFAULT '',
  page_url        TEXT DEFAULT '',
  canonical_url   TEXT DEFAULT '',
  views           INTEGER DEFAULT 0,
  visitors        INTEGER DEFAULT 0,
  sessions        INTEGER DEFAULT 0,
  search_views    INTEGER DEFAULT 0,
  message_count   INTEGER DEFAULT 0,
  last_view_at    TEXT DEFAULT NULL,
  last_message_at TEXT DEFAULT NULL,
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- 每日页面访客去重表
CREATE TABLE IF NOT EXISTS analytics_daily_visitors (
  date       TEXT NOT NULL,
  page_id    TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (date, page_id, visitor_id)
);

-- 每日页面会话去重表
CREATE TABLE IF NOT EXISTS analytics_daily_sessions (
  date       TEXT NOT NULL,
  page_id    TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (date, page_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_page_created ON analytics_events(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_channel ON analytics_events(channel);
CREATE INDEX IF NOT EXISTS idx_analytics_events_referrer_domain ON analytics_events(referrer_domain);
CREATE INDEX IF NOT EXISTS idx_analytics_page_daily_date ON analytics_page_daily(date);
CREATE INDEX IF NOT EXISTS idx_analytics_page_daily_views ON analytics_page_daily(date, views DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_page_totals_views ON analytics_page_totals(views DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_page_totals_updated ON analytics_page_totals(updated_at DESC);

-- 记录迁移版本
INSERT OR IGNORE INTO _migrations (name) VALUES ('001_init');
