import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const databasePath = Bun.env.DATABASE_PATH ?? "data/bunilite.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath, { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS users_email_index ON users(email);

    CREATE TABLE IF NOT EXISTS user_sessions (
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
    CREATE INDEX IF NOT EXISTS sessions_user_active_index ON user_sessions(user_id, is_active, expired_at);

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      expired_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_session_index ON refresh_tokens(session_id, revoked, expired_at);
  `);
}
