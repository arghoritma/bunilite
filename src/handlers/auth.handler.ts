import type { Context } from "hono";
import type { AppEnv } from "../types";
import {
  createUser,
  listActiveSessions,
  login,
  logout,
  logoutAll,
  refresh,
} from "../services/auth.service";
import { isValidEmail, validationError } from "../utils/validation";

type AppContext = Context<AppEnv>;

async function requestBody(c: AppContext) {
  return (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function register(c: AppContext) {
  const body = await requestBody(c);
  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  const errors: Record<string, string> = {};
  if (!name) errors.name = "name is required";
  else if (name.trim().length < 3 || name.trim().length > 30)
    errors.name = "name must be between 3 and 30 characters";
  if (!email) errors.email = "email is required";
  else if (!isValidEmail(email)) errors.email = "email format is invalid";
  if (!password) errors.password = "password is required";
  else if (password.length < 6 || password.length > 50)
    errors.password = "password must be between 6 and 50 characters";
  if (Object.keys(errors).length) return c.json(validationError(errors), 400);

  const user = await createUser(name, email, password);
  if (!user)
    return c.json(
      { code: "USER_EXISTS", message: "Email is already registered" },
      400,
    );
  return c.json(
    {
      code: "REGISTER_SUCCESS",
      message: "User registered successfully",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.created_at,
        },
      },
    },
    201,
  );
}

export async function loginUser(c: AppContext) {
  const body = await requestBody(c);
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
}

export async function refreshToken(c: AppContext) {
  const body = await requestBody(c);
  if (typeof body.refreshToken !== "string" || !body.refreshToken) {
    return c.json(
      validationError({ refreshToken: "refreshToken is required" }),
      400,
    );
  }
  const tokens = await refresh(body.refreshToken);
  if (!tokens) {
    return c.json(
      {
        code: "INVALID_REFRESH_TOKEN",
        message: "Invalid or expired refresh token",
      },
      401,
    );
  }
  return c.json({
    code: "REFRESH_SUCCESS",
    message: "Token refreshed successfully",
    data: tokens,
  });
}

export function getSessions(c: AppContext) {
  const sessions = listActiveSessions(c.var.user.id).map((session) => ({
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
}

export async function logoutCurrent(c: AppContext) {
  await logout(c.var.user);
  return c.json({ code: "LOGOUT_SUCCESS", message: "Logout successful" });
}

export async function logoutEverywhere(c: AppContext) {
  await logoutAll(c.var.user.id);
  return c.json({
    code: "LOGOUT_ALL_SUCCESS",
    message: "Logged out from all devices successfully",
  });
}
