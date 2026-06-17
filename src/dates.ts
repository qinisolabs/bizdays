const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a strict YYYY-MM-DD string into a UTC Date, or throw. */
export function parseISODate(input: string): Date {
  if (!ISO_DATE.test(input)) {
    throw new Error(`Date must be in YYYY-MM-DD format (got "${input}").`);
  }
  const [y, m, d] = input.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new Error(`"${input}" is not a real calendar date.`);
  }
  return date;
}

/** Format a UTC Date as YYYY-MM-DD. */
export function formatISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Return a new Date offset by n whole days (UTC). */
export function addDays(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** English weekday name for a UTC date. */
export function weekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getUTCDay()];
}
