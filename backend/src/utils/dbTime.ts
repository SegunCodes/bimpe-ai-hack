/**
 * Scheduling times are TIMESTAMPTZ columns. We always send ISO 8601 strings with a "Z"
 * so the server's timezone setting can never shift them, and always return ISO strings.
 */
export function toDbUtc(date: Date): string {
  return date.toISOString();
}

export function fromDbUtc(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}
