/** Versioned SQL migrations with checksum verification and transactional execution. */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { Database } from "bun:sqlite";

const migrationsDirectory = join(import.meta.dir, "..", "..", "migrations");
const migrationPattern = /^\d{4,}_[a-z0-9_]+\.sql$/;
const sectionMarkerPattern = /^\s*--\s*(up|down)\s*$/gim;
const migrationNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

type Migration = {
  version: string;
  file: string;
  upSql: string;
  downSql: string;
  checksum: string;
};

type AppliedMigration = {
  version: string;
  checksum: string | null;
};

type TableColumn = {
  name: string;
  type: string;
  notnull: number;
  pk: number;
};

type TableIndex = {
  name: string;
  unique: number;
  origin: string;
  partial: number;
};

const checksum = (sql: string) =>
  createHash("sha256").update(sql).digest("hex");

function hasSqlStatement(sql: string) {
  return sql.replace(/--[^\r\n]*/g, "").trim().length > 0;
}

function readMigrations(directory = migrationsDirectory): Migration[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory)
    .filter((file) => migrationPattern.test(file))
    .sort()
    .map((file) => {
      const sql = readFileSync(join(directory, file), "utf8");
      const markers = [...sql.matchAll(sectionMarkerPattern)].map((match) => ({
        name: match[1],
        index: match.index ?? 0,
        length: match[0].length,
      }));
      const upMarker = markers.find((marker) => marker.name === "up");
      const downMarker = markers.find((marker) => marker.name === "down");
      if (
        markers.length !== 2 ||
        !upMarker ||
        !downMarker ||
        upMarker.index > downMarker.index
      ) {
        throw new Error(
          `Migration ${file} must contain -- up followed by -- down markers.`,
        );
      }
      const upSql = sql
        .slice(upMarker.index + upMarker.length, downMarker.index)
        .trim();
      const downSql = sql.slice(downMarker.index + downMarker.length).trim();
      if (!hasSqlStatement(upSql) || !hasSqlStatement(downSql)) {
        throw new Error(
          `Migration ${file} must have SQL statements in both up and down sections.`,
        );
      }
      return { version: file, file, upSql, downSql, checksum: checksum(sql) };
    });
}

function tableColumns(db: Database, table: string) {
  return db
    .query<
      { name: string },
      []
    >(`PRAGMA table_info("${table.replaceAll('"', '""')}")`)
    .all();
}

function tableExists(db: Database, table: string) {
  return tableColumns(db, table).length > 0;
}

function createMigrationTable(db: Database) {
  db.exec(`CREATE TABLE schema_migrations (
    version TEXT PRIMARY KEY,
    checksum TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`);
}

function upgradeLegacyMigrationTable(db: Database, directory: string) {
  if (!tableExists(db, "schema_migrations")) {
    createMigrationTable(db);
    return;
  }

  const columns = tableColumns(db, "schema_migrations").map(
    (column) => column.name,
  );
  if (columns.includes("version") && columns.includes("checksum")) return;
  if (!columns.includes("id"))
    throw new Error("schema_migrations has an unsupported schema.");

  const legacyIds = db
    .query<{ id: string }, []>("SELECT id FROM schema_migrations ORDER BY id")
    .all();
  const legacyVersions: Record<string, string> = {
    "20261001055728_initial_schema": "0001_initial_schema.sql",
    "20261001062102_add_avatar_to_users": "0002_add_avatar_to_users.sql",
  };
  const migrations = new Map(
    readMigrations(directory).map((migration) => [
      migration.version,
      migration,
    ]),
  );
  const translated = legacyIds.map(({ id }) => {
    const version = legacyVersions[id];
    const migration = version ? migrations.get(version) : undefined;
    if (!migration)
      throw new Error(`Cannot upgrade unknown legacy migration: ${id}`);
    return migration;
  });

  db.transaction(() => {
    db.exec("ALTER TABLE schema_migrations RENAME TO schema_migrations_legacy");
    createMigrationTable(db);
    const insert = db.query<null, [string, string]>(
      "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
    );
    for (const migration of translated)
      insert.run(migration.version, migration.checksum);
    db.exec("DROP TABLE schema_migrations_legacy");
  })();
}

function baselineExistingSchema(db: Database, migrations: Migration[]) {
  const appliedCount =
    db
      .query<
        { count: number },
        []
      >("SELECT COUNT(*) AS count FROM schema_migrations")
      .get()?.count ?? 0;
  if (
    appliedCount ||
    !["users", "user_sessions", "refresh_tokens"].every((table) =>
      tableExists(db, table),
    )
  )
    return;

  const appliedVersions = ["0001_initial_schema.sql"];
  if (tableColumns(db, "users").some((column) => column.name === "avatar"))
    appliedVersions.push("0002_add_avatar_to_users.sql");
  const migrationByVersion = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const insert = db.query<null, [string, string]>(
    "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
  );
  for (const version of appliedVersions) {
    const migration = migrationByVersion.get(version);
    if (!migration)
      throw new Error(`Baseline migration is missing: ${version}`);
    insert.run(migration.version, migration.checksum);
  }
}

function appliedVersions(db: Database, migrations: Migration[]) {
  const known = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const applied = db
    .query<
      AppliedMigration,
      []
    >("SELECT version, checksum FROM schema_migrations")
    .all();
  for (const row of applied) {
    const migration = known.get(row.version);
    if (!migration)
      throw new Error(`Applied migration is missing from disk: ${row.version}`);
    if (row.checksum !== migration.checksum)
      throw new Error(`Applied migration was modified: ${row.version}`);
  }
  return new Set(applied.map((row) => row.version));
}

function prepareMigrations(db: Database, directory: string) {
  upgradeLegacyMigrationTable(db, directory);
  const migrations = readMigrations(directory);
  baselineExistingSchema(db, migrations);
  return { migrations, applied: appliedVersions(db, migrations) };
}

export function migrateLatest(db: Database, directory = migrationsDirectory) {
  const { migrations, applied } = prepareMigrations(db, directory);
  const pending = migrations.filter(
    (migration) => !applied.has(migration.version),
  );
  const insert = db.query<null, [string, string]>(
    "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
  );
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.upSql);
      insert.run(migration.version, migration.checksum);
    })();
  }
  return pending.length;
}

export function rollbackLatest(db: Database, directory = migrationsDirectory) {
  const { migrations } = prepareMigrations(db, directory);
  const latest = db
    .query<
      AppliedMigration,
      []
    >("SELECT version, checksum FROM schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1")
    .get();
  if (!latest) return null;
  const migration = migrations.find((item) => item.version === latest.version);
  if (!migration)
    throw new Error(
      `Applied migration is missing from disk: ${latest.version}`,
    );
  db.transaction(() => {
    db.exec(migration.downSql);
    db.query<null, [string]>(
      "DELETE FROM schema_migrations WHERE version = ?",
    ).run(migration.version);
  })();
  return migration.version;
}

export function migrationStatus(db: Database, directory = migrationsDirectory) {
  const { migrations, applied } = prepareMigrations(db, directory);
  return migrations.map((migration) => ({
    version: migration.version,
    applied: applied.has(migration.version),
    reversible: true,
  }));
}

/** Create a reversible SQL migration in the project-level migrations directory. */
export function createMigration(name: string) {
  if (!migrationNamePattern.test(name)) {
    throw new Error(
      "Migration name must be lowercase snake_case, for example add_posts_table.",
    );
  }
  mkdirSync(migrationsDirectory, { recursive: true });
  const versions = readdirSync(migrationsDirectory)
    .map((file) => /^(\d{4,})_/.exec(file)?.[1])
    .filter((version): version is string => Boolean(version))
    .map(Number);
  const version = String(
    (versions.length ? Math.max(...versions) : 0) + 1,
  ).padStart(4, "0");
  const file = `${version}_${name}.sql`;
  const filePath = join(migrationsDirectory, file);
  if (existsSync(filePath))
    throw new Error(`Migration ${file} already exists.`);
  writeFileSync(
    filePath,
    `# ${file.slice(0, -4)}\n\n-- up\n-- Apply schema changes here.\n\n-- down\n-- Revert schema changes here.\n`,
  );
  return filePath;
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/** Write a DBML ERD from the migrated application schema. */
export function generateErd(
  db: Database,
  filePath = join(import.meta.dir, "..", "..", "erd.dbml"),
) {
  const tables = db
    .query<
      { name: string },
      []
    >("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations' ORDER BY name")
    .all();
  const definitions = tables.map(({ name }) => {
    const columns = db
      .query<TableColumn, []>(`PRAGMA table_info(${quoteIdentifier(name)})`)
      .all();
    const indexes = db
      .query<TableIndex, []>(`PRAGMA index_list(${quoteIdentifier(name)})`)
      .all();
    const indexLines = indexes
      .filter((index) => index.origin === "c")
      .flatMap((index) => {
        const indexColumns = db
          .query<{ name: string }, []>(
            `PRAGMA index_info(${quoteIdentifier(index.name)})`,
          )
          .all()
          .map((column) => column.name);
        if (!indexColumns.length) return [];
        const attributes = [
          index.unique ? "unique" : null,
          `name: '${index.name}'`,
          index.partial ? "note: 'partial index'" : null,
        ].filter((attribute): attribute is string => Boolean(attribute));
        return `    ${indexColumns.join(", ")} [${attributes.join(", ")}]`;
      });
    const columnLines = columns.map((column) => {
      const attributes = [
        column.pk ? "pk" : null,
        column.notnull ? "not null" : null,
      ].filter((attribute): attribute is string => Boolean(attribute));
      return `  ${column.name} ${column.type.toLowerCase() || "text"}${attributes.length ? ` [${attributes.join(", ")}]` : ""}`;
    });
    const indexBlock = indexLines.length
      ? `\n\n  indexes {\n${indexLines.join("\n")}\n  }`
      : "";
    return `Table ${name} {\n${columnLines.join("\n")}${indexBlock}\n}`;
  });
  const references = tables.flatMap(({ name }) =>
    db
      .query<{ from: string; table: string; to: string }, []>(
        `PRAGMA foreign_key_list(${quoteIdentifier(name)})`,
      )
      .all()
      .map(
        (foreignKey) =>
          `Ref: ${name}.${foreignKey.from} > ${foreignKey.table}.${foreignKey.to}`,
      ),
  );
  writeFileSync(
    filePath,
    `// Generated from the migrated SQLite schema. Do not edit manually.\n${[...definitions, ...references].length ? `\n\n${[...definitions, ...references].join("\n\n")}\n` : ""}`,
  );
}
