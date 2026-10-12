import { db } from "../configs/db";
import { generateErd, migrateLatest, migrationStatus, rollbackLatest } from "../migrations/runner";

const command = Bun.argv[2] ?? "up";

try {
if (command === "up" || command === "latest") {
  const count = await migrateLatest(db);
  console.log(count ? `Applied ${count} migration(s).` : "Database is already up to date.");
  generateErd(db);
} else if (command === "down" || command === "rollback") {
  const migration = await rollbackLatest(db);
  console.log(migration ? `Rolled back ${migration}.` : "No migration to roll back.");
  generateErd(db);
} else if (command === "status") {
  for (const migration of migrationStatus(db)) {
    console.log(`${migration.applied ? "applied" : "pending"}\t${migration.reversible ? "reversible" : "up-only"}\t${migration.version}`);
  }
} else {
  console.error("Usage: bun src/scripts/migrate.ts [up|status] | bun run db:rollback");
  process.exitCode = 1;
}
} finally {
  db.close();
}
