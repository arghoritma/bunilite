import { db } from "../configs/db";
import type { User } from "../types";

export function getProfile(userId: string) {
  return db
    .query<Pick<User, "id" | "name" | "email" | "created_at" | "updated_at">, [string]>(
      "SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?",
    )
    .get(userId);
}
