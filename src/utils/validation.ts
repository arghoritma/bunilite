export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validationError(errors: Record<string, string>) {
  return { errors };
}
