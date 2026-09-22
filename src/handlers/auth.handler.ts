import { createUser, isValidEmail } from "../auth";

function validationError(errors: Record<string, string>) {
  return { errors };
}

export async function register(c: any) {
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
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
