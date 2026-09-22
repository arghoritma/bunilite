import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const name = Bun.argv.slice(2).join(" ");
const normalizedName = name
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

if (!normalizedName) {
  console.error("Usage: bun run migrate:make -- <migration-name>");
  process.exitCode = 1;
} else {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const directory = join(import.meta.dir, "..", "migrations");
  const filePath = join(directory, `${timestamp}_${normalizedName}.ts`);
  const template = `import type { Migration } from "./types";\n\nexport const up: Migration["up"] = (db) => {\n  db.exec(\`\n    -- Add schema changes here.\n  \`);\n};\n\nexport const down: Migration["down"] = (db) => {\n  db.exec(\`\n    -- Revert schema changes here.\n  \`);\n};\n`;

  await mkdir(directory, { recursive: true });
  await writeFile(filePath, template, { flag: "wx" });
  console.log(`Created migration: src/migrations/${timestamp}_${normalizedName}.ts`);
}
