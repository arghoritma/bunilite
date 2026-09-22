import type { Context } from "hono";
import { broadcast } from "../services/websocket.service";
import { validationError } from "../utils/validation";

export async function sendBroadcast(c: Context) {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.type !== "string" || !body.type) {
    return c.json(validationError({ type: "type is required" }), 400);
  }
  broadcast(JSON.stringify({ type: body.type, payload: body.payload }));
  return c.json({ code: "SUCCESS", message: "Broadcast sent" });
}
