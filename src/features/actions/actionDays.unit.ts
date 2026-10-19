import { test, expect } from '@playwright/test';
import type {
  Dosage,
  MedicationAdministration,
  MedicationRequest,
} from 'fhir/r5';
import {
  addDays,
  buildActionDay,
  daysEndingOn,
  formatDayLabel,
  getJournalDays,
  getStripEnd,
  isDayComplete,
} from './actionDays';
import { buildUsageStatement } from './treatmentUsage';

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

test('the strip centres the selected day until it reaches today', () => {
  const today = '2026-10-16';
  expect(getStripEnd('2026-10-16', today)).toBe('2026-10-16');
  expect(getStripEnd('2026-10-14', today)).toBe('2026-10-16');
  expect(getStripEnd('2026-10-13', today)).toBe('2026-10-16');
  expect(getStripEnd('2026-10-12', today)).toBe('2026-10-15');
  expect(daysEndingOn(getStripEnd('2026-09-29', today))[3]).toBe('2026-09-29');
});

test('the journal loads the neighbouring days before the rest of its strips', () => {
  const today = '2026-10-16';
  const recent = getJournalDays('2026-10-10', today);
  expect(recent.nearby).toEqual([
    '2026-10-08',
    '2026-10-09',
    '2026-10-10',
    '2026-10-11',
    '2026-10-12',
  ]);
  // The rest of the last 21 days, never a loaded day twice.
  expect(recent.strip).toHaveLength(21 - 5);
  expect(recent.strip).not.toContain('2026-10-10');
  expect(recent.strip).toContain(today);
  expect(recent.strip).toContain('2026-09-26');

  // No days after today.
  expect(getJournalDays(today, today).nearby).toEqual([
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
  ]);

  // An older day also loads its own strip, as well as the recent one.
  const older = getJournalDays('2026-08-01', today);
  expect(older.nearby[0]).toBe('2026-07-30');
  expect(older.strip).toContain('2026-07-22');
  expect(older.strip).toContain('2026-08-11');
  expect(older.strip).toContain(today);
  expect(older.strip).toHaveLength(2 * 21 - 5);
});

/** A "taking" usage period for a treatment, from `start` to `end`. */
const taking = (id: string, start: string, end?: string) => {
  const statement = buildUsageStatement(
    treatment(id, 'active'),
    'p1',
    'taking',
    start,
    `use-${id}-${start}`
  );
  if (end) statement.effectivePeriod = { start, end };
  return statement;
};

test('a day lists active treatments being taken and any answered one', () => {
  const treatments = [
    treatment('active', 'active', '2026-10-01'),
    treatment('also-active', 'active'),
    treatment('not-started', 'active', '2026-09-01'),
    treatment('later', 'active', '2026-10-01'),
    treatment('paused', 'active', '2026-10-01'),
    treatment('stopped', 'stopped', '2026-09-01'),
    treatment('stopped-logged', 'stopped', '2026-09-01'),
  ];
  const statements = [
    taking('active', '2026-10-01'),
    taking('also-active', '2026-10-05'),
    taking('later', '2026-10-06'),
    taking('paused', '2026-10-01', '2026-10-04'),
    taking('stopped', '2026-09-01'),
  ];
  const day = buildActionDay(
    '2026-10-05',
    treatments,
    [
      log('stopped-logged', '2026-10-05', 'completed'),
      log('active', '2026-10-04', 'completed'),
      log('also-active', '2026-10-05', 'not-done'),
    ],
    statements
  );
  expect(day.items.map(({ rowId, answer }) => [rowId, answer])).toEqual([
    ['active', null],
    ['also-active', 'not-taken'],
    ['stopped-logged-2026-10-05', 'taken'],
  ]);
  expect(isDayComplete(day)).toBe(false);

  const answered = buildActionDay(
    '2026-10-05',
    treatments.slice(1, 2),
    [log('also-active', '2026-10-05', 'not-done')],
    statements
  );
  expect(isDayComplete(answered)).toBe(true);
  expect(isDayComplete(buildActionDay('2026-10-05', [], []))).toBe(false);
});

const dose = (sequence: number, when: string, days?: number): Dosage => ({
  sequence,
  doseAndRate: [
    { doseQuantity: { value: 1, unit: 'tablet', code: '{tablet}' } },
  ],
  timing: {
    repeat: {
      frequency: 1,
      period: 1,
      periodUnit: 'd',
      when: [when as 'MORN'],
      ...(days && { boundsDuration: { value: days, unit: 'days', code: 'd' } }),
    },
  },
});

test('a structured regimen lists one row per dose of the current phase', () => {
  const regimen: MedicationRequest = {
    ...treatment('regimen', 'active', '2026-10-01'),
    dosageInstruction: [
      dose(1, 'MORN', 7),
      dose(1, 'EVE', 7),
      dose(2, 'EVE', 7),
    ],
  };
  const rows = (date: string, logs: MedicationAdministration[] = []) =>
    buildActionDay(date, [regimen], logs, [
      taking('regimen', '2026-10-01'),
    ]).items.map((item) => [item.rowId, item.dose?.text, item.answer]);

  expect(
    rows('2026-10-07', [
      {
        ...log('regimen', '2026-10-07', 'completed'),
        id: 'regimen-2026-10-07-1',
      },
    ])
  ).toEqual([
    ['regimen-0', '1 tablet in the morning, for 7 days', null],
    ['regimen-1', '1 tablet in the evening, for 7 days', 'taken'],
  ]);
  // The second phase starts once the first week's course ends.
  expect(rows('2026-10-08')).toEqual([
    ['regimen-2', '1 tablet in the evening, for 7 days', null],
  ]);
  // Nothing is due after the last phase; earlier answers still show.
  expect(rows('2026-10-15')).toEqual([]);
  expect(
    rows('2026-10-15', [
      {
        ...log('regimen', '2026-10-15', 'not-done'),
        id: 'regimen-2026-10-15-2',
        dosage: { text: '1 tablet in the evening' },
      },
    ])
  ).toEqual([['regimen-2026-10-15-2', '1 tablet in the evening', 'not-taken']]);
});

test('labels name today, yesterday and older days', () => {
  expect(formatDayLabel('2026-10-08', '2026-10-08')).toBe('Today');
  expect(formatDayLabel('2026-10-07', '2026-10-08')).toBe('Yesterday');
  expect(formatDayLabel('2026-10-05', '2026-10-08')).toBe('Mon, Oct 5');
});
