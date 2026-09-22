import { Hono } from "hono";
import { profile } from "../handlers/user.handler";
import { requireAuth } from "../middlewares/auth.middleware";
import type { AppEnv } from "../types";

const userRoute = new Hono<AppEnv>();

userRoute.get("/users/profile", requireAuth, profile);

export default userRoute;
