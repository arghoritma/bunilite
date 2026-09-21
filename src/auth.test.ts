import { expect, test } from "bun:test";
import { isValidEmail } from "./auth";

test("validates email addresses used by authentication endpoints", () => {
  expect(isValidEmail("user@example.com")).toBe(true);
  expect(isValidEmail("not-an-email")).toBe(false);
});
