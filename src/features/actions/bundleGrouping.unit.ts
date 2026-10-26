import { test, expect } from '@playwright/test';
import type { Dosage, MedicationRequest, ServiceRequest } from 'fhir/r5';
import {
  buildBundle,
  type BundleTime,
} from '@/src/features/bundles/bundleModel';
import type { ActionItem } from './actionDays';
import type { ProcedureItem } from './procedureDays';
import {
  getBundleAnswer,
  getBundleChanges,
  groupActionDay,
  type JournalRow,
} from './bundleGrouping';

const TIMES = { MORN: '08:00', EVE: '18:00' };

const treatment = (id: string): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  intent: 'plan',
  subject: { reference: 'Patient/p1' },
  medication: { concept: { text: id } },
});

/** A dose item; `at` is a part of the day (MORN) or a clock time (07:30). */
const item = (
  id: string,
  at?: string,
  extra: Partial<ActionItem> = {}
): ActionItem => {
  const repeat = !at
    ? undefined
    : /^\d/.test(at)
      ? { timeOfDay: [`${at}:00`] }
      : { when: [at as 'MORN'] };
  const dosage: Dosage | undefined = repeat && { timing: { repeat } };
  return {
    key: `${id}-${at ?? 'any'}`,
    rowId: `${id}-${at ?? 'any'}`,
    treatment: treatment(id),
    ...(dosage && { dose: { index: 0, dosage, text: at! } }),
    answer: null,
    ...extra,
  };
};

const time = (value: string): BundleTime =>
  /^\d/.test(value)
    ? { kind: 'time', time: value }
    : { kind: 'when', code: value as 'MORN' };

/** A scheduled activity's item; `at` is a part of the day (MORN). */
const activity = (id: string, at?: string): ProcedureItem => {
  const request: ServiceRequest = {
    resourceType: 'ServiceRequest',
    id,
    status: 'active',
    intent: 'plan',
    subject: { reference: 'Patient/p1' },
    occurrenceTiming: {
      repeat: {
        period: 1,
        periodUnit: 'd',
        ...(at && { when: [at as 'MORN'] }),
      },
    },
  };
  return { key: `${id}-log`, rowId: id, request, answer: null, duration: null };
};

const bundle = (
  id: string,
  memberIds: string[],
  times: string[] = [],
  activityIds: string[] = []
) =>
  buildBundle(
    { title: id, memberIds, activityIds, times: times.map(time) },
    { id, patientId: 'p1', now: new Date('2026-10-19T08:00:00Z') }
  );

/** Rows as "bundle@slot: keys" or item keys, for readable assertions. */
const describe = (rows: JournalRow[]) =>
  rows.map((row) =>
    row.kind === 'bundle'
      ? `${row.key}: ${[...row.items, ...row.procedures].map((entry) => entry.key).join(', ')}`
      : row.item.key
  );

test('a bundle without a time takes all doses of its treatments', () => {
  const rows = groupActionDay(
    [item('a', 'MORN'), item('a', 'EVE'), item('b'), item('c')],
    [bundle('x', ['a', 'b'])],
    TIMES
  );
  expect(describe(rows)).toEqual(['x:0: a-MORN, a-EVE, b-any', 'c-any']);
});

test('parts of the day and exact times match through the settings', () => {
  const rows = groupActionDay(
    [item('a', 'MORN'), item('a', 'EVE'), item('b', '08:00')],
    [bundle('x', ['a', 'b'], ['08:00'])],
    TIMES
  );
  // Evening dose of a stays its own row.
  expect(describe(rows)).toEqual(['x:0: a-MORN, b-08:00', 'a-EVE']);
});

test('several times split a treatment between them', () => {
  const rows = groupActionDay(
    [item('a', 'MORN'), item('a', 'EVE'), item('b'), item('b')].map(
      (entry, index) => ({ ...entry, key: `${entry.key}-${index}` })
    ),
    [bundle('x', ['a', 'b'], ['EVE', 'MORN'])],
    TIMES
  );
  // Untimed doses fill the remaining times in order; rows by clock time.
  expect(describe(rows)).toEqual([
    'x:1: a-MORN-0, b-any-3',
    'x:0: a-EVE-1, b-any-2',
  ]);
});

test('a single dose joins the nearest time even when it differs', () => {
  const rows = groupActionDay(
    [item('a', '09:15')],
    [bundle('x', ['a'], ['07:30', '20:00'])],
    TIMES
  );
  expect(describe(rows)).toEqual(['x:0: a-09:15']);
});

test('earlier bundles claim doses first; rows follow clock time', () => {
  const rows = groupActionDay(
    [item('a'), item('b', 'EVE'), item('c', 'MORN')],
    [bundle('x', ['a', 'b'], ['EVE']), bundle('y', ['a', 'c'], ['MORN'])],
    TIMES
  );
  expect(describe(rows)).toEqual(['y:0: c-MORN', 'x:0: a-any, b-EVE']);
});

test('answers that no longer match are never grouped', () => {
  const rows = groupActionDay(
    [item('a', 'MORN'), item('b', 'MORN', { mismatch: true, key: 'old' })],
    [bundle('x', ['a', 'b'], ['MORN'])],
    TIMES
  );
  expect(describe(rows)).toEqual(['x:0: a-MORN', 'old']);
});

test('bundles with nothing due that day are left out', () => {
  const rows = groupActionDay([item('c')], [bundle('x', ['a'])], TIMES);
  expect(describe(rows)).toEqual(['c-any']);
});

test('bundle buttons answer every dose and clear when pressed again', () => {
  const doses = [
    item('a', undefined, { answer: 'taken' }),
    item('b', undefined, { answer: 'not-taken' }),
  ];
  expect(getBundleAnswer(doses)).toBeNull();
  expect(
    getBundleChanges({ items: doses, procedures: [] }, 'taken').items.map(
      ({ item: entry, answer }) => [entry.key, answer]
    )
  ).toEqual([['b-any', 'taken']]);
  const allTaken = doses.map((dose) => ({ ...dose, answer: 'taken' as const }));
  expect(getBundleAnswer(allTaken)).toBe('taken');
  expect(
    getBundleChanges({ items: allTaken, procedures: [] }, 'taken').items.map(
      ({ answer }) => answer
    )
  ).toEqual([null, null]);
});

test('a bundle groups its activities with its doses at their time', () => {
  const rows = groupActionDay(
    [item('a', 'MORN'), item('a', 'EVE')],
    [bundle('x', ['a'], ['MORN', 'EVE'], ['walk', 'read'])],
    TIMES,
    [activity('walk', 'EVE'), activity('read'), activity('other', 'MORN')]
  );
  // The untimed activity fills the first time it has not filled yet.
  expect(describe(rows)).toEqual([
    'x:0: a-MORN, read-log',
    'x:1: a-EVE, walk-log',
    'other-log',
  ]);
});

test('bundle buttons answer its activities too', () => {
  const row = {
    items: [item('a', undefined, { answer: 'taken' })],
    procedures: [activity('walk')],
  };
  expect(getBundleAnswer([...row.items, ...row.procedures])).toBeNull();
  const changes = getBundleChanges(row, 'taken');
  expect(changes.items).toEqual([]);
  expect(changes.procedures.map(({ item: entry }) => entry.key)).toEqual([
    'walk-log',
  ]);
});
