-- 添加最少字数限制字段
ALTER TABLE board_config ADD COLUMN min_message_length INTEGER DEFAULT 2;

-- 记录迁移
INSERT OR IGNORE INTO _migrations (name) VALUES ('003_add_min_length');
