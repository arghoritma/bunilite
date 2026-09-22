import type { Database } from "bun:sqlite";

export type Migration = {
  up: (db: Database) => void;
  down: (db: Database) => void;
};
