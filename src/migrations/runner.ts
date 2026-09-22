import type { Database } from "bun:sqlite";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Migration } from "./types";

const migrationsDirectory = join(import.meta.dir);

type LoadedMigration = Migration & {
  id: string;
};

type AppliedMigration = {
  id: string;
  batch: number;
};

async function loadMigrations(): Promise<LoadedMigration[]> {
  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+_[a-z0-9_]+\.ts$/.test(file))
    .sort();

  return Promise.all(
    files.map(async (file) => {
      const module = (await import(pathToFileURL(join(migrationsDirectory, file)).href)) as Partial<Migration>;
      if (typeof module.up !== "function" || typeof module.down !== "function") {
        throw new Error(`Migration ${file} must export up and down functions.`);
      }
      return { id: file.slice(0, -3), up: module.up, down: module.down };
    }),
  );
}

function ensureMigrationTable(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      batch INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedMigrations(db: Database) {
  return db.query<AppliedMigration, []>("SELECT id, batch FROM schema_migrations ORDER BY id ASC").all();
}

function hasTable(db: Database, name: string) {
  return Boolean(
    db.query<{ name: string }, [string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name),
  );
}

function baselineExistingSchema(db: Database, migrations: LoadedMigration[]) {
  const initialMigration = migrations.find((migration) => migration.id === "001_initial_schema");
  if (!initialMigration || appliedMigrations(db).some((migration) => migration.id === initialMigration.id)) return;
  if (!["users", "user_sessions", "refresh_tokens"].every((table) => hasTable(db, table))) return;

  db.query("INSERT INTO schema_migrations (id, batch, applied_at) VALUES (?, ?, ?)").run(
    initialMigration.id,
    1,
    new Date().toISOString(),
  );
}

export async function migrateLatest(db: Database) {
  ensureMigrationTable(db);
  const migrations = await loadMigrations();
  baselineExistingSchema(db, migrations);
  const applied = new Set(appliedMigrations(db).map((migration) => migration.id));
  const pending = migrations.filter((migration) => !applied.has(migration.id));
  if (!pending.length) return 0;

  const batch = Math.max(0, ...appliedMigrations(db).map((migration) => migration.batch)) + 1;
  const run = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db);
      db.query("INSERT INTO schema_migrations (id, batch, applied_at) VALUES (?, ?, ?)").run(
        migration.id,
        batch,
        new Date().toISOString(),
      );
    }
  });
  run();
  return pending.length;
}

export async function rollbackLatest(db: Database) {
  ensureMigrationTable(db);
  const migrations = new Map((await loadMigrations()).map((migration) => [migration.id, migration]));
  const applied = appliedMigrations(db);
  const batch = Math.max(0, ...applied.map((migration) => migration.batch));
  if (!batch) return 0;

  const toRollback = applied.filter((migration) => migration.batch === batch).reverse();
  const rollback = db.transaction(() => {
    for (const appliedMigration of toRollback) {
      const migration = migrations.get(appliedMigration.id);
      if (!migration) throw new Error(`Migration file is missing: ${appliedMigration.id}.ts`);
      migration.down(db);
      db.query("DELETE FROM schema_migrations WHERE id = ?").run(appliedMigration.id);
    }
  });
  rollback();
  return toRollback.length;
}
