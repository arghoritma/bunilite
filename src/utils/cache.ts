import { RedisClient } from "bun";
import type { Session } from "../types";

const url = Bun.env.REDIS_URL;
const client = url
  ? new RedisClient(url, {
      connectionTimeout: 1_000,
      maxRetries: 0,
      enableOfflineQueue: false,
    })
  : null;

let available = false;

export async function connectCache() {
  if (!client) return;
  try {
    await client.connect();
    available = true;
  } catch {
    client.close();
    console.warn("Redis unavailable; continuing without session cache.");
  }
}

export async function cacheSession(session: Session) {
  if (!available || !client) return;
  const ttl = Math.max(
    1,
    Math.floor((Date.parse(session.expired_at) - Date.now()) / 1000),
  );
  try {
    await client.set(
      `session:${session.id}`,
      JSON.stringify(session),
      "EX",
      ttl,
    );
    await client.sadd(`user_sessions:${session.user_id}`, session.id);
    await client.expire(`user_sessions:${session.user_id}`, ttl);
  } catch {
    available = false;
    client.close();
  }
}

export async function removeSession(session: Pick<Session, "id" | "user_id">) {
  if (!available || !client) return;
  try {
    await client.del(`session:${session.id}`);
    await client.srem(`user_sessions:${session.user_id}`, session.id);
  } catch {
    available = false;
    client.close();
  }
}

export async function removeUserSessions(userId: string) {
  if (!available || !client) return;
  try {
    const ids = await client.smembers(`user_sessions:${userId}`);
    await Promise.all(ids.map((id) => client.del(`session:${id}`)));
    await client.del(`user_sessions:${userId}`);
  } catch {
    available = false;
    client.close();
  }
}
