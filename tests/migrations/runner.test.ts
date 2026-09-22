import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { migrateLatest, rollbackLatest } from "../../src/migrations/runner";

const databases: Database[] = [];

function createDatabase() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  databases.push(db);
  return db;
}

function tableExists(db: Database, table: string) {
  return Boolean(
    db.query<{ name: string }, [string]>("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
  );
}

afterEach(() => {
  for (const db of databases.splice(0)) db.close();
});

describe("migration runner", () => {
  test("applies pending migrations once and records their batch", async () => {
    const db = createDatabase();

    expect(await migrateLatest(db)).toBe(1);
    expect(tableExists(db, "users")).toBe(true);
    expect(tableExists(db, "user_sessions")).toBe(true);
    expect(tableExists(db, "refresh_tokens")).toBe(true);
    expect(
      db.query<{ id: string; batch: number }, []>("SELECT id, batch FROM schema_migrations").all(),
    ).toEqual([{ id: "001_initial_schema", batch: 1 }]);

    expect(await migrateLatest(db)).toBe(0);
  });

  test("rolls back the latest migration batch", async () => {
    const db = createDatabase();
    await migrateLatest(db);

    expect(await rollbackLatest(db)).toBe(1);
    expect(tableExists(db, "users")).toBe(false);
    expect(tableExists(db, "user_sessions")).toBe(false);
    expect(tableExists(db, "refresh_tokens")).toBe(false);
    expect(db.query<{ count: number }, []>("SELECT COUNT(*) AS count FROM schema_migrations").get()?.count).toBe(0);
    expect(await rollbackLatest(db)).toBe(0);
  });

  test("baselines a database created before versioned migrations", async () => {
    const db = createDatabase();
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY);
      CREATE TABLE user_sessions (id TEXT PRIMARY KEY);
      CREATE TABLE refresh_tokens (id TEXT PRIMARY KEY);
    `);

    expect(await migrateLatest(db)).toBe(0);
    expect(
      db.query<{ id: string; batch: number }, []>("SELECT id, batch FROM schema_migrations").all(),
    ).toEqual([{ id: "001_initial_schema", batch: 1 }]);
  });
});
