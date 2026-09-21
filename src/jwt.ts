import { SignJWT, jwtVerify } from "jose";
import type { TokenPayload } from "./types";

const encoder = new TextEncoder();
const accessSecret = encoder.encode(Bun.env.ACCESS_SECRET ?? "development-access-secret-change-me");
const refreshSecret = encoder.encode(Bun.env.REFRESH_SECRET ?? "development-refresh-secret-change-me");

export async function signToken(payload: TokenPayload, expiresIn: string) {
  const secret = payload.type === "access" ? accessSecret : refreshSecret;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setJti(crypto.randomUUID())
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string, type: TokenPayload["type"]) {
  const secret = type === "access" ? accessSecret : refreshSecret;
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  if (
    payload.type !== type ||
    typeof payload.userId !== "string" ||
    typeof payload.sessionId !== "string" ||
    typeof payload.deviceId !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  return payload as unknown as TokenPayload;
}
