import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const databasePath = Bun.env.DATABASE_PATH ?? "data/bunilite.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath, { create: true });
db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
