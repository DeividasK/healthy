import { test, expect } from '@playwright/test';
import type { MedicationAdministration, MedicationRequest } from 'fhir/r5';
import {
  addDays,
  buildActionDay,
  daysEndingOn,
  formatActionsHeading,
  formatDayLabel,
  getDayWindow,
  isDayComplete,
} from './actionDays';

const treatment = (
  id: string,
  status: MedicationRequest['status'],
  authoredOn?: string
): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id,
  status,
  intent: 'plan',
  subject: { reference: 'Patient/p1' },
  medication: { concept: { text: id } },
  authoredOn,
});

const log = (
  requestId: string,
  date: string,
  status: MedicationAdministration['status']
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: `${requestId}-${date}`,
  status,
  medication: { concept: { text: requestId } },
  subject: { reference: 'Patient/p1' },
  request: { reference: `MedicationRequest/${requestId}` },
  occurenceDateTime: date,
});

test('days run across month and year boundaries', () => {
  expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  expect(daysEndingOn('2026-10-03')).toEqual([
    '2026-09-27',
    '2026-09-28',
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
  ]);
});

test('the window is the week ending today until an older day is selected', () => {
  expect(getDayWindow('2026-10-04', '2026-10-08').at(-1)).toBe('2026-10-08');
  expect(getDayWindow('2026-10-02', '2026-10-08').at(-1)).toBe('2026-10-08');
  expect(getDayWindow('2026-10-01', '2026-10-08').at(-1)).toBe('2026-10-01');
});

test('a day lists active treatments started by then and any answered one', () => {
  const treatments = [
    treatment('active', 'active', '2026-10-01'),
    treatment('undated', 'active'),
    treatment('later', 'active', '2026-10-06T09:00:00+03:00'),
    treatment('stopped', 'stopped', '2026-09-01'),
    treatment('stopped-logged', 'stopped', '2026-09-01'),
  ];
  const day = buildActionDay('2026-10-05', treatments, [
    log('stopped-logged', '2026-10-05', 'completed'),
    log('active', '2026-10-04', 'completed'),
    log('undated', '2026-10-05', 'not-done'),
  ]);
  expect(day.treatments.map(({ id }) => id)).toEqual([
    'active',
    'undated',
    'stopped-logged',
  ]);
  expect(day.answers).toEqual({
    'stopped-logged': 'taken',
    undated: 'not-taken',
  });
  expect(isDayComplete(day)).toBe(false);

  const answered = buildActionDay('2026-10-05', treatments.slice(1, 2), [
    log('undated', '2026-10-05', 'not-done'),
  ]);
  expect(isDayComplete(answered)).toBe(true);
  expect(isDayComplete(buildActionDay('2026-10-05', [], []))).toBe(false);
});

test('labels and headings name today, yesterday and older days', () => {
  expect(formatDayLabel('2026-10-08', '2026-10-08')).toBe('Today');
  expect(formatDayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
  expect(formatDayLabel('2026-10-05', '2026-10-08')).toBe('Mon, Oct 5');
  expect(formatActionsHeading('2026-10-08', '2026-10-08')).toBe(
    "What's happening today, October 8?"
  );
  expect(formatActionsHeading('2026-10-05', '2026-10-08')).toBe(
    'What happened on Monday, October 5?'
  );
});
