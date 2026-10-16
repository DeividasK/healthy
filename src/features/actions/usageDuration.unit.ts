import { expect, test } from '@playwright/test';
import { formatUsageDuration } from './usageDuration';

for (const [start, end, expected] of [
  ['2026-10-16', '2026-10-16', '1 day'],
  ['2026-10-01', '2026-10-02', '2 days'],
  ['2026-10-05', '2026-10-14', '10 days'],
  ['2025-01-01', '2026-03-03', '1 year, 2 months, 3 days'],
  ['2024-01-01', '2025-12-31', '2 years'],
  ['2026-01-01', '2026-01-31', '1 month'],
  ['2026-01-31', '2026-02-27', '1 month'],
  ['2024-02-28', '2024-03-01', '3 days'],
  ['2026-03-28', '2026-03-30', '3 days'],
  ['2026-10-24', '2026-10-26', '3 days'],
  ['2026-12-31', '2027-01-01', '2 days'],
  ['2026-10-17', '2026-10-16', ''],
]) {
  test(`inclusive duration ${start} through ${end}: ${expected || 'empty'}`, () => {
    expect(formatUsageDuration(start, end)).toBe(expected);
  });
}

test('open periods count through the local current date', () => {
  const now = new Date();
  const localDay = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  expect(formatUsageDuration(localDay)).toBe('1 day');
});
