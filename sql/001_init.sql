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

-- 记录迁移版本
INSERT OR IGNORE INTO _migrations (name) VALUES ('001_init');
