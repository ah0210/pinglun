-- 为留言记录增加提交 IP 地址
ALTER TABLE messages ADD COLUMN ip_address TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_messages_page_created ON messages(page_id, created_at DESC);

INSERT OR IGNORE INTO _migrations (name) VALUES ('003_add_message_ip');
