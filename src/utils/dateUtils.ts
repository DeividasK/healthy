/**
 * Formats a Date object to 'YYYY-MM-DD' using local date components,
 * avoiding timezone offset shifts caused by Date.prototype.toISOString().
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:mm...') date string into a local Date object.
 * Avoids the ECMAScript behavior where date-only strings ('YYYY-MM-DD') are parsed as UTC midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  if (dateStr.includes('T')) {
    const [datePart, timePart] = dateStr.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = (timePart || '00:00').split(':').map(Number);
    return new Date(y, m - 1, d, hh || 0, mm || 0);
  }

  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Same as `date.toLocaleDateString('en-US', options)`, but reuses one
 * formatter per set of options: building a formatter is slow, and lists
 * format a date for every row.
 */
export function formatEnUsDate(
  date: Date,
  options: Intl.DateTimeFormatOptions
): string {
  if (Number.isNaN(date.getTime())) return 'Invalid Date';
  const key = JSON.stringify(options);
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', options);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}

/**
 * Formats a date string ('YYYY-MM-DD' or with time) for display (e.g., 'Sep 26, 2026').
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const date = parseLocalDate(dateStr);
    return formatEnUsDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Formats a date string ('YYYY-MM-DD' or with time) for display (e.g., 'Sep 26, 2026' or 'Sep 26, 2026, 14:30').
 */
export function formatDisplayDateTime(dateStr: string): string {
  try {
    const date = parseLocalDate(dateStr);
    const datePart = formatEnUsDate(date, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (dateStr.includes('T')) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${datePart}, ${hours}:${minutes}`;
    }
    return datePart;
  } catch {
    return dateStr;
  }
}

/** The local day `delta` days after `date` (YYYY-MM-DD). */
export function addDays(date: string, delta: number): string {
  const day = parseLocalDate(date);
  day.setDate(day.getDate() + delta);
  return formatLocalDate(day);
}
