import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { ServerWebSocket } from "bun";
import {
  authenticate,
  createUser,
  isValidEmail,
  login,
  logout,
  logoutAll,
  refresh,
} from "./auth";
import { connectCache } from "./utils/cache";
import { db, migrate } from "./configs/db";
import type { Session, User } from "./types";
import AuthRoute from "./routes/auth";

const app = new Hono();
const sockets = new Set<ServerWebSocket<unknown>>();

app.use("/", serveStatic({ path: "./public/index.html" }));
app.use("/public/*", serveStatic({ root: "./" }));

app.get("/health", (c) => c.json({ status: "ok" }));

function validationError(errors: Record<string, string>) {
  return { errors };
}
app.route("/api", AuthRoute);

app.post("/api/auth/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const deviceId =
    typeof body.deviceId === "string" ? body.deviceId : undefined;
  const errors: Record<string, string> = {};
  if (!email) errors.email = "email is required";
  else if (!isValidEmail(email)) errors.email = "email format is invalid";
  if (!password) errors.password = "password is required";
  if (Object.keys(errors).length) return c.json(validationError(errors), 400);
  const result = await login(email, password, deviceId, c.req.raw);
  if (!result)
    return c.json(
      { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      401,
    );
  return c.json({
    code: "LOGIN_SUCCESS",
    message: "Login successful",
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
      },
      session: {
        sessionId: result.session.id,
        deviceId: result.session.device_id,
        expiresAt: result.session.expired_at,
      },
    },
  });
});

app.post("/api/auth/refresh-token", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (typeof body.refreshToken !== "string" || !body.refreshToken) {
    return c.json(
      validationError({ refreshToken: "refreshToken is required" }),
      400,
    );
  }
  const tokens = await refresh(body.refreshToken);
  if (!tokens)
    return c.json(
      {
        code: "INVALID_REFRESH_TOKEN",
        message: "Invalid or expired refresh token",
      },
      401,
    );
  return c.json({
    code: "REFRESH_SUCCESS",
    message: "Token refreshed successfully",
    data: tokens,
  });
});

async function requireUser(request: Request) {
  return authenticate(request.headers.get("authorization") ?? undefined);
}

app.get("/api/auth/sessions", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user)
    return c.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );
  const sessions = db
    .query<Session, [string, string]>(
      "SELECT * FROM user_sessions WHERE user_id = ? AND is_active = 1 AND expired_at > ? ORDER BY last_used_at DESC",
    )
    .all(user.id, new Date().toISOString())
    .map((session) => ({
      sessionId: session.id,
      deviceId: session.device_id,
      ip: session.ip_address,
      userAgent: session.user_agent,
      createdAt: session.created_at,
      expiredAt: session.expired_at,
    }));
  return c.json({
    code: "SUCCESS",
    message: "Sessions retrieved successfully",
    data: { sessions },
  });
});

app.get("/api/auth/logout", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user)
    return c.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );
  await logout(user);
  return c.json({ code: "LOGOUT_SUCCESS", message: "Logout successful" });
});

app.get("/api/auth/logout-all", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user)
    return c.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );
  await logoutAll(user.id);
  return c.json({
    code: "LOGOUT_ALL_SUCCESS",
    message: "Logged out from all devices successfully",
  });
});

app.get("/api/users/profile", async (c) => {
  const user = await requireUser(c.req.raw);
  if (!user)
    return c.json(
      { code: "UNAUTHORIZED", message: "Authentication required" },
      401,
    );
  const profile = db
    .query<
      Pick<User, "id" | "name" | "email" | "created_at" | "updated_at">,
      [string]
    >("SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?")
    .get(user.id);
  return c.json({
    code: "SUCCESS",
    message: "Profile retrieved successfully",
    data: { user: profile },
  });
});

app.post("/api/ws/broadcast", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (typeof body.type !== "string" || !body.type)
    return c.json(validationError({ type: "type is required" }), 400);
  const message = JSON.stringify({ type: body.type, payload: body.payload });
  for (const socket of sockets) socket.send(message);
  return c.json({ code: "SUCCESS", message: "Broadcast sent" });
});

app.notFound((c) =>
  c.json({ code: "NOT_FOUND", message: "Route not found" }, 404),
);
app.onError((error, c) => {
  console.error(error);
  return c.json(
    { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    500,
  );
});

migrate();
await connectCache();
const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch(request, server) {
    if (new URL(request.url).pathname === "/ws" && server.upgrade(request))
      return undefined;
    return app.fetch(request, { server });
  },
  websocket: {
    open(socket) {
      sockets.add(socket);
    },
    close(socket) {
      sockets.delete(socket);
    },
    message() {},
    idleTimeout: 60,
    maxPayloadLength: 32 * 1024,
  },
});

console.log(`bunilite listening on http://localhost:${port}`);
