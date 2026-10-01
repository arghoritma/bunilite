import type { Migration } from "./types";

export const up: Migration["up"] = (db) => {
  db.exec(`
    ALTER TABLE users ADD COLUMN avatar TEXT;
  `);
};

export const down: Migration["down"] = (db) => {
  db.exec(`
    ALTER TABLE users DROP COLUMN avatar;
  `);
};
