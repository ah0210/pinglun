-- 用户表增加邮箱验证时间（如果列已存在则忽略错误）
-- SQLite 不支持 IF NOT EXISTS 语法用于 ADD COLUMN
-- 若报 duplicate column 错误说明列已存在，可安全忽略
ALTER TABLE users ADD COLUMN email_verified_at TEXT DEFAULT NULL;

INSERT OR IGNORE INTO _migrations (name) VALUES ('005_email_verified_at');
