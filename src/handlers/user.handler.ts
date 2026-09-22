import type { Context } from "hono";
import { getProfile } from "../services/user.service";
import type { AppEnv } from "../types";

export function profile(c: Context<AppEnv>) {
  return c.json({
    code: "SUCCESS",
    message: "Profile retrieved successfully",
    data: { user: getProfile(c.var.user.id) },
  });
}
