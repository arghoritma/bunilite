# 0003_add_refresh_tokens

-- up
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expired_at TEXT NOT NULL
);
CREATE INDEX refresh_tokens_session_index ON refresh_tokens(session_id, revoked, expired_at);

-- down
DROP TABLE refresh_tokens;
