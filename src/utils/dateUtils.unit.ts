import { expect, test } from '@playwright/test';
import { formatEnUsDate, formatDisplayDate, parseLocalDate } from './dateUtils';

test('formats exactly as toLocaleDateString, reusing formatters', () => {
  const options: Intl.DateTimeFormatOptions[] = [
    { month: 'short', day: 'numeric', year: 'numeric' },
    { weekday: 'short' },
    { weekday: 'long', month: 'long', day: 'numeric' },
    { month: 'long', year: 'numeric' },
  ];
  for (const date of ['2026-01-05', '2026-10-21T14:30', '2024-02-29'])
    for (const option of options) {
      const day = parseLocalDate(date);
      expect(formatEnUsDate(day, option)).toBe(
        day.toLocaleDateString('en-US', option)
      );
      // The second call uses the cached formatter.
      expect(formatEnUsDate(day, option)).toBe(
        day.toLocaleDateString('en-US', option)
      );
    }
});

test('shows unparseable dates as before', () => {
  expect(formatDisplayDate('not-a-date')).toBe(
    new Date(NaN).toLocaleDateString('en-US')
  );
});
