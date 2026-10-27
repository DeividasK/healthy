import { addDays, parseLocalDate } from '@/src/utils/dateUtils';

/** A calendar date, not part of a longer number or other date. */
const ISO_DATE = /(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g;

/**
 * Moves every YYYY-MM-DD in `text` by `days`, keeping whatever follows it,
 * such as a time. The demo's dates, including the ones inside record ids,
 * all count from the day it was made, so moving them together keeps it as
 * it was that day.
 */
export function shiftDates(text: string, days: number): string {
  if (days === 0) return text;
  return text.replace(ISO_DATE, (date, year, month, day) => {
    const parsed = parseLocalDate(date);
    // Leaves strings that only look like dates, such as 2026-13-40.
    const real =
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() + 1 === Number(month) &&
      parsed.getDate() === Number(day);
    return real ? addDays(date, days) : date;
  });
}

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  const ms = parseLocalDate(to).getTime() - parseLocalDate(from).getTime();
  // Rounds away a daylight saving hour.
  return Math.round(ms / 86_400_000);
}
