-- 登录失败记录表（替代内存 Map，支持多边缘节点分布式限流）
CREATE TABLE IF NOT EXISTS login_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address TEXT NOT NULL,
  success    INTEGER NOT NULL DEFAULT 0,  -- 0=失败, 1=成功
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, created_at);

INSERT OR IGNORE INTO _migrations (name) VALUES ('006_login_attempts');
