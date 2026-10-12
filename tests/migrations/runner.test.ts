import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateLatest, migrationStatus, rollbackLatest } from "../../src/migrations/runner";

const databases: Database[] = [];
const migrationDirectories: string[] = [];

const initialSchema = `-- 0001_initial_schema

-- up
CREATE TABLE users (id TEXT PRIMARY KEY);
CREATE TABLE user_sessions (id TEXT PRIMARY KEY);
CREATE TABLE refresh_tokens (id TEXT PRIMARY KEY);

-- down
DROP TABLE refresh_tokens;
DROP TABLE user_sessions;
DROP TABLE users;
`;

const addAvatar = `-- 0002_add_avatar_to_users

-- up
ALTER TABLE users ADD COLUMN avatar TEXT;

-- down
ALTER TABLE users DROP COLUMN avatar;
`;

function createDatabase() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  databases.push(db);
  return db;
}

function createMigrationDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "bunilite-migrations-"));
  writeFileSync(join(directory, "0001_initial_schema.sql"), initialSchema);
  writeFileSync(join(directory, "0002_add_avatar_to_users.sql"), addAvatar);
  migrationDirectories.push(directory);
  return directory;
}

function tableExists(db: Database, table: string) {
  return Boolean(
    db.query<{ name: string }, [string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
  for (const directory of migrationDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("migration runner", () => {
  test("applies pending migrations once and records checksums", () => {
    const db = createDatabase();
    const migrations = createMigrationDirectory();

    expect(migrateLatest(db, migrations)).toBe(2);
    expect(tableExists(db, "users")).toBe(true);
    expect(tableExists(db, "user_sessions")).toBe(true);
    expect(tableExists(db, "refresh_tokens")).toBe(true);
    expect(tableExists(db, "schema_migrations")).toBe(true);
    expect(db.query<{ version: string; checksum: string }, []>("SELECT version, checksum FROM schema_migrations ORDER BY version").all()).toEqual([
      expect.objectContaining({ version: "0001_initial_schema.sql", checksum: expect.any(String) }),
      expect.objectContaining({ version: "0002_add_avatar_to_users.sql", checksum: expect.any(String) }),
    ]);

    expect(migrateLatest(db, migrations)).toBe(0);
  });

  test("rolls back exactly the latest migration", () => {
    const db = createDatabase();
    const migrations = createMigrationDirectory();
    migrateLatest(db, migrations);

    expect(rollbackLatest(db, migrations)).toBe("0002_add_avatar_to_users.sql");
    expect(db.query<{ name: string }, []>("PRAGMA table_info(users)").all().some((column) => column.name === "avatar")).toBe(false);
    expect(tableExists(db, "users")).toBe(true);
    expect(rollbackLatest(db, migrations)).toBe("0001_initial_schema.sql");
    expect(tableExists(db, "users")).toBe(false);
    expect(rollbackLatest(db, migrations)).toBeNull();
  });

  test("upgrades legacy migration metadata without rerunning the schema", () => {
    const db = createDatabase();
    const migrations = createMigrationDirectory();
    migrateLatest(db, migrations);
    db.exec("ALTER TABLE schema_migrations RENAME TO schema_migrations_new");
    db.exec("CREATE TABLE schema_migrations (id TEXT PRIMARY KEY, batch INTEGER NOT NULL, applied_at TEXT NOT NULL)");
    db.exec("INSERT INTO schema_migrations (id, batch, applied_at) VALUES ('20261001055728_initial_schema', 1, '2026-10-01T00:00:00.000Z')");
    db.exec("INSERT INTO schema_migrations (id, batch, applied_at) VALUES ('20261001062102_add_avatar_to_users', 1, '2026-10-01T00:00:00.000Z')");
    db.exec("DROP TABLE schema_migrations_new");

    expect(migrateLatest(db, migrations)).toBe(0);
    expect(migrationStatus(db, migrations)).toEqual([
      { version: "0001_initial_schema.sql", applied: true, reversible: true },
      { version: "0002_add_avatar_to_users.sql", applied: true, reversible: true },
    ]);
  });

  test("rejects a draft migration containing only comments", () => {
    const db = createDatabase();
    const migrations = createMigrationDirectory();
    writeFileSync(join(migrations, "0003_add_posts.sql"), "-- 0003_add_posts\n\n-- up\n-- Apply schema changes here.\n\n-- down\n-- Revert schema changes here.\n");

    expect(() => migrateLatest(db, migrations)).toThrow("Migration 0003_add_posts.sql must have SQL statements in both up and down sections.");
  });
});
