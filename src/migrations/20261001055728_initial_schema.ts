import type { Migration } from "./types";

export const up: Migration["up"] = (db) => {
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX users_email_index ON users(email);

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

    CREATE TABLE refresh_tokens (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expired_at TEXT NOT NULL
    );
    CREATE INDEX refresh_tokens_session_index ON refresh_tokens(session_id, revoked, expired_at);
  `);
};

export const down: Migration["down"] = (db) => {
  db.exec(`
    DROP TABLE refresh_tokens;
    DROP TABLE user_sessions;
    DROP TABLE users;
  `);
};
