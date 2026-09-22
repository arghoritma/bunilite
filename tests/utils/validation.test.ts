import { describe, expect, test } from "bun:test";
import { isValidEmail, validationError } from "../../src/utils/validation";

describe("validation utilities", () => {
  test("accepts valid email addresses", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@example.co.id")).toBe(true);
  });

  test("rejects invalid email addresses", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("user@example")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });

  test("keeps validation errors in the API response shape", () => {
    expect(validationError({ email: "email is required" })).toEqual({
      errors: { email: "email is required" },
    });
  });
});
