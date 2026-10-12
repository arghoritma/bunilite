# 0002_add_user_sessions

-- up
CREATE TABLE user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expired_at TEXT NOT NULL
);
CREATE INDEX sessions_user_active_index ON user_sessions(user_id, is_active, expired_at);

-- down
DROP TABLE user_sessions;
