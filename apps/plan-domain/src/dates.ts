export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical YYYY-MM-DD from a Date in local timezone (never UTC drift). */
export function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

/** Parse a canonical day key into a local noon Date (timezone-safe). */
export function parseLocalDayKey(key: string): Date | null {
  if (!isValidDateOnly(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addLocalDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function quickDateToday(now = new Date()): string {
  return localDayKey(now);
}

export function quickDateTomorrow(now = new Date()): string {
  return localDayKey(addLocalDays(now, 1));
}

/** Seven calendar days from today (local). */
export function quickDateNextWeek(now = new Date()): string {
  return localDayKey(addLocalDays(now, 7));
}

export function canonicalDateOnly(
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 10);
  return isValidDateOnly(trimmed) ? trimmed : null;
}

/** Friendly label e.g. "Tue, 25 Aug" — Today/Tomorrow when applicable. */
export function formatFriendlyDate(
  dateKey: string,
  now = new Date(),
  locale = 'en-GB',
): string {
  const canonical = canonicalDateOnly(dateKey);
  if (!canonical) return dateKey;
  const today = quickDateToday(now);
  const tomorrow = quickDateTomorrow(now);
  if (canonical === today) return 'Today';
  if (canonical === tomorrow) return 'Tomorrow';
  const date = parseLocalDayKey(canonical);
  if (!date) return canonical;
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
