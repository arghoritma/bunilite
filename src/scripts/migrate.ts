import { db } from "../configs/db";
import { migrateLatest, rollbackLatest } from "../migrations/runner";

const command = Bun.argv[2];

if (command === "latest") {
  const count = await migrateLatest(db);
  console.log(count ? `Applied ${count} migration(s).` : "Database is already up to date.");
} else if (command === "rollback") {
  const count = await rollbackLatest(db);
  console.log(count ? `Rolled back ${count} migration(s).` : "No migration batch to roll back.");
} else {
  console.error("Usage: bun src/scripts/migrate.ts <latest|rollback>");
  process.exitCode = 1;
}

db.close();
