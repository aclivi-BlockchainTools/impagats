// Whitelist-based input validation: only allow specified fields
export function pick(obj: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in obj) result[key] = obj[key];
  }
  return result;
}
