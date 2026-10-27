import { expect, test } from '@playwright/test';
import { daysBetween, shiftDates } from './demoDates';

test('moves dates and keeps their times', () => {
  expect(shiftDates('2026-10-27', 5)).toBe('2026-11-01');
  expect(shiftDates('2023-10-27T08:15:00', 5)).toBe('2023-11-01T08:15:00');
  expect(shiftDates('2026-10-27T11:26:53.736Z', -27)).toBe(
    '2026-09-30T11:26:53.736Z'
  );
  expect(shiftDates('2024-02-28', 1)).toBe('2024-02-29');
});

test('moves every date in a record, including ids', () => {
  expect(
    shiftDates(
      '{"id":"abc-2026-10-13-0","period":{"start":"2026-10-13","end":"2026-10-14"}}',
      2
    )
  ).toBe(
    '{"id":"abc-2026-10-15-0","period":{"start":"2026-10-15","end":"2026-10-16"}}'
  );
});

test('leaves ids, numbers and impossible dates alone', () => {
  const id = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  expect(shiftDates(id, 3)).toBe(id);
  expect(shiftDates('12026-10-27', 3)).toBe('12026-10-27');
  expect(shiftDates('2026-10-279', 3)).toBe('2026-10-279');
  expect(shiftDates('2026-13-40', 3)).toBe('2026-13-40');
  expect(shiftDates('2026-10-27', 0)).toBe('2026-10-27');
});

test('counts whole days across months and daylight saving', () => {
  expect(daysBetween('2026-10-20', '2026-10-27')).toBe(7);
  expect(daysBetween('2026-10-27', '2026-10-20')).toBe(-7);
  expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
  expect(daysBetween('2026-10-27', '2026-10-27')).toBe(0);
});
