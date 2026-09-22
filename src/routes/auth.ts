import { Hono } from "hono";
import { register } from "../handlers/auth.handler";

const authRoute = async () => {
  const app = new Hono();

  app.post("/auth/register", register);
};

export default authRoute;
/*

import { Hono } from "hono";
import { clearFlash } from "../auth";
import { noStore } from "../cache";
import type { AppEnv } from "../inertia-middleware";
import type { FlashData, User } from "../../shared/types";

export const apiRoutes = () => {
	const app = new Hono<AppEnv>();

	app.get("/api/session", noStore, (c) => {
		const user: User | null = c.var.user;
		const flash: FlashData = c.var.flash;
		if (c.var.sessionToken) clearFlash(c.var.sessionToken);
		return c.json({ user, flash });
	});

	return app;
};


*/
