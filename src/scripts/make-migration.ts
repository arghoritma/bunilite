import { createMigration } from "../migrations/runner";

const name = Bun.argv[2];
if (!name) {
  console.error("Usage: bun run db:make -- <lowercase_snake_case_name>");
  process.exitCode = 1;
} else {
  try {
    console.log(`Created ${createMigration(name)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
