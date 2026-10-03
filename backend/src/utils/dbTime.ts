/**
 * Scheduling times are stored in MySQL DATETIME columns as UTC wall-clock values.
 * DATETIME has no timezone, so we convert explicitly instead of relying on the
 * server's or the driver's local timezone.
 */

/** Date -> "YYYY-MM-DD HH:MM:SS" in UTC, for DATETIME columns. */
export function toDbUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/**
 * DATETIME value from mysql2 -> ISO 8601 UTC string ("…Z").
 * mysql2 parses a DATETIME as *local* time, so the Date's local fields hold the stored UTC wall clock.
 */
export function fromDbUtc(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds())
    ).toISOString();
  }
  const text = String(value);
  return new Date(text.includes("T") ? text : text.replace(" ", "T") + "Z").toISOString();
}
