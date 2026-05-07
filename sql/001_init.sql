-- ============================================
-- 留言板系统完整 Schema (D1 / SQLite) v2.2
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
  email_verified  INTEGER DEFAULT 0,
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

-- 留言表
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id    TEXT NOT NULL DEFAULT '',
  content    TEXT NOT NULL,
  is_secret  INTEGER DEFAULT 0,
  status     TEXT DEFAULT 'approved',
  reply_to   INTEGER DEFAULT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT NULL
);

-- 留言板配置表（单行配置）
CREATE TABLE IF NOT EXISTS board_config (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  site_name            TEXT DEFAULT '留言板',
  max_message_length   INTEGER DEFAULT 500,
  require_captcha      INTEGER DEFAULT 1,
  moderation_enabled   INTEGER DEFAULT 0,
  daily_secret_limit   INTEGER DEFAULT 5,
  allow_registration   INTEGER DEFAULT 1,
  updated_at           TEXT DEFAULT (datetime('now'))
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

-- 记录初始迁移
INSERT OR IGNORE INTO _migrations (name) VALUES ('001_init');
