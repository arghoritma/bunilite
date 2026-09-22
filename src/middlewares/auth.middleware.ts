import type { MiddlewareHandler } from "hono";
import { authenticate } from "../services/auth.service";
import type { AppEnv } from "../types";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await authenticate(c.req.header("authorization"));
  if (!user) {
    return c.json({ code: "UNAUTHORIZED", message: "Authentication required" }, 401);
  }
  c.set("user", user);
  await next();
};
