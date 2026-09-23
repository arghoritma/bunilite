import { db } from "../configs/db";
import type { AuthUser, Session, TokenPayload, User } from "../types";
import {
  cacheSession,
  removeSession,
  removeUserSessions,
} from "../utils/cache";
import { signToken, verifyToken } from "../utils/jwt";

const sessionDurationMs = 30 * 24 * 60 * 60 * 1000;
const now = () => new Date().toISOString();

export async function createUser(
  name: string,
  email: string,
  password: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db
    .query<User, [string]>("SELECT * FROM users WHERE email = ?")
    .get(normalizedEmail);
  if (existing) return null;

  const timestamp = now();
  const user: User = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password: await Bun.password.hash(password, {
      algorithm: "bcrypt",
      cost: 10,
    }),
    created_at: timestamp,
    updated_at: timestamp,
  };

  try {
    db.query(
      "INSERT INTO users (id, name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(
      user.id,
      user.name,
      user.email,
      user.password,
      user.created_at,
      user.updated_at,
    );
    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE")) return null;
    throw error;
  }
}

export async function login(
  email: string,
  password: string,
  deviceId: string | undefined,
  request: Request,
) {
  const user = db
    .query<User, [string]>("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (!user || !(await Bun.password.verify(password, user.password)))
    return null;

  const timestamp = now();
  const session: Session = {
    id: crypto.randomUUID(),
    user_id: user.id,
    device_id: deviceId || crypto.randomUUID(),
    ip_address:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown",
    user_agent: request.headers.get("user-agent") ?? "unknown",
    is_active: 1,
    created_at: timestamp,
    last_used_at: timestamp,
    expired_at: new Date(Date.now() + sessionDurationMs).toISOString(),
  };
  db.query(
    "INSERT INTO user_sessions (id, user_id, device_id, ip_address, user_agent, is_active, created_at, last_used_at, expired_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    session.id,
    session.user_id,
    session.device_id,
    session.ip_address,
    session.user_agent,
    session.is_active,
    session.created_at,
    session.last_used_at,
    session.expired_at,
  );
  const tokens = await issueTokens(session);
  await cacheSession(session);
  return { user, session, ...tokens };
}

async function issueTokens(session: Session) {
  const payload: Omit<TokenPayload, "type"> = {
    userId: session.user_id,
    sessionId: session.id,
    deviceId: session.device_id,
  };
  const accessToken = await signToken({ ...payload, type: "access" }, "15m");
  const refreshToken = await signToken({ ...payload, type: "refresh" }, "30d");
  db.query(
    "INSERT INTO refresh_tokens (id, session_id, token_hash, revoked, created_at, expired_at) VALUES (?, ?, ?, 0, ?, ?)",
  ).run(
    crypto.randomUUID(),
    session.id,
    await Bun.password.hash(refreshToken, { algorithm: "bcrypt", cost: 10 }),
    now(),
    session.expired_at,
  );
  return { accessToken, refreshToken };
}

function activeSession(sessionId: string, userId: string) {
  return db
    .query<
      Session,
      [string, string, string]
    >("SELECT * FROM user_sessions WHERE id = ? AND user_id = ? AND is_active = 1 AND expired_at > ?")
    .get(sessionId, userId, now());
}

export async function authenticate(
  header: string | undefined,
): Promise<AuthUser | null> {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const token = await verifyToken(header.slice(7), "access");
    const session = activeSession(token.sessionId, token.userId);
    if (!session || session.device_id !== token.deviceId) return null;
    const user = db
      .query<User, [string]>("SELECT * FROM users WHERE id = ?")
      .get(token.userId);
    return user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          sessionId: session.id,
          deviceId: session.device_id,
        }
      : null;
  } catch {
    return null;
  }
}

export async function refresh(rawToken: string) {
  try {
    const token = await verifyToken(rawToken, "refresh");
    const session = activeSession(token.sessionId, token.userId);
    if (!session || session.device_id !== token.deviceId) return null;
    const candidates = db
      .query<
        { token_hash: string },
        [string, string]
      >("SELECT token_hash FROM refresh_tokens WHERE session_id = ? AND revoked = 0 AND expired_at > ? ORDER BY created_at DESC")
      .all(session.id, now());
    const valid = await Promise.all(
      candidates.map((candidate) =>
        Bun.password.verify(rawToken, candidate.token_hash),
      ),
    );
    if (!valid.some(Boolean)) return null;
    db.query("UPDATE refresh_tokens SET revoked = 1 WHERE session_id = ?").run(
      session.id,
    );
    db.query("UPDATE user_sessions SET last_used_at = ? WHERE id = ?").run(
      now(),
      session.id,
    );
    return issueTokens(session);
  } catch {
    return null;
  }
}

export function listActiveSessions(userId: string) {
  return db
    .query<
      Session,
      [string, string]
    >("SELECT * FROM user_sessions WHERE user_id = ? AND is_active = 1 AND expired_at > ? ORDER BY last_used_at DESC")
    .all(userId, now());
}

export async function logout(user: AuthUser) {
  db.query(
    "UPDATE user_sessions SET is_active = 0 WHERE id = ? AND user_id = ?",
  ).run(user.sessionId, user.id);
  db.query("UPDATE refresh_tokens SET revoked = 1 WHERE session_id = ?").run(
    user.sessionId,
  );
  await removeSession({ id: user.sessionId, user_id: user.id });
}

export async function logoutAll(userId: string) {
  const sessions = db
    .query<
      Session,
      [string]
    >("SELECT * FROM user_sessions WHERE user_id = ? AND is_active = 1")
    .all(userId);
  db.query("UPDATE user_sessions SET is_active = 0 WHERE user_id = ?").run(
    userId,
  );
  for (const session of sessions) {
    db.query("UPDATE refresh_tokens SET revoked = 1 WHERE session_id = ?").run(
      session.id,
    );
  }
  await removeUserSessions(userId);
}
