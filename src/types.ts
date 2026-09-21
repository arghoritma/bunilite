export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
};

export type Session = {
  id: string;
  user_id: string;
  device_id: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: number;
  created_at: string;
  last_used_at: string;
  expired_at: string;
};

export type TokenPayload = {
  userId: string;
  sessionId: string;
  deviceId: string;
  type: "access" | "refresh";
};

export type AuthUser = Pick<User, "id" | "name" | "email"> & {
  sessionId: string;
  deviceId: string;
};
