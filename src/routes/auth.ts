import { Hono } from "hono";
import { getSessions, loginUser, logoutCurrent, logoutEverywhere, refreshToken, register } from "../handlers/auth.handler";
import { requireAuth } from "../middlewares/auth.middleware";
import type { AppEnv } from "../types";

const authRoute = new Hono<AppEnv>();

authRoute.post("/auth/register", register);
authRoute.post("/auth/login", loginUser);
authRoute.post("/auth/refresh-token", refreshToken);
authRoute.get("/auth/sessions", requireAuth, getSessions);
authRoute.get("/auth/logout", requireAuth, logoutCurrent);
authRoute.get("/auth/logout-all", requireAuth, logoutEverywhere);

export default authRoute;
