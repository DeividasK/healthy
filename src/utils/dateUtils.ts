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

/**
 * Formats a date string ('YYYY-MM-DD' or with time) for display (e.g., 'Sep 26, 2026').
 */
export function formatDisplayDate(dateStr: string): string {
  try {
    const date = parseLocalDate(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
