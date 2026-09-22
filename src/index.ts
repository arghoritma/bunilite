import type { ServerWebSocket } from "bun";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import authRoute from "./routes/auth";
import userRoute from "./routes/user";
import websocketRoute from "./routes/websocket";
import { addSocket, removeSocket } from "./services/websocket.service";
import type { AppEnv } from "./types";
import { connectCache } from "./utils/cache";

const app = new Hono<AppEnv>();

app.use("/", serveStatic({ path: "./public/index.html" }));
app.use("/public/*", serveStatic({ root: "./" }));

app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/api", authRoute);
app.route("/api", userRoute);
app.route("/api", websocketRoute);

app.notFound((c) => c.json({ code: "NOT_FOUND", message: "Route not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ code: "INTERNAL_ERROR", message: "An unexpected error occurred" }, 500);
});

await connectCache();
const port = Number(Bun.env.PORT ?? 3000);

Bun.serve({
  port,
  fetch(request, server) {
    if (new URL(request.url).pathname === "/ws" && server.upgrade(request)) return undefined;
    return app.fetch(request, { server });
  },
  websocket: {
    open(socket: ServerWebSocket<unknown>) {
      addSocket(socket);
    },
    close(socket: ServerWebSocket<unknown>) {
      removeSocket(socket);
    },
    message() {},
    idleTimeout: 60,
    maxPayloadLength: 32 * 1024,
  },
});

console.log(`bunilite listening on http://localhost:${port}`);
