import { test, expect } from '@playwright/test';
import type { Dosage, MedicationRequest } from 'fhir/r5';
import { buildBundle } from '@/src/features/bundles/bundleModel';
import { DEFAULT_TIMES_OF_DAY } from '@/src/features/settings/profileSettings';
import type { ActionItem } from './actionDays';
import { groupActionDay, type JournalRow } from './bundleGrouping';
import {
  applyJournalOrder,
  canMoveJournalRow,
  groupJournalRows,
  moveJournalRow,
} from './journalGroups';

const treatment = (id: string): MedicationRequest => ({
  resourceType: 'MedicationRequest',
  id,
  status: 'active',
  intent: 'plan',
  subject: { reference: 'Patient/p1' },
  medication: { concept: { text: id } },
});

/** A dose row; `at` lists parts of the day (MORN) and clock times (07:30). */
const row = (id: string, ...at: string[]): JournalRow => {
  const when = at.filter((value) => !/^\d/.test(value));
  const timeOfDay = at
    .filter((value) => /^\d/.test(value))
    .map((value) => `${value}:00`);
  const dosage: Dosage | undefined = at.length
    ? {
        timing: {
          repeat: {
            ...(when.length && { when: when as 'MORN'[] }),
            ...(timeOfDay.length && { timeOfDay }),
          },
        },
      }
    : undefined;
  const key = `${id}-${at.join('+') || 'any'}`;
  const item: ActionItem = {
    key,
    rowId: key,
    treatment: treatment(id),
    ...(dosage && { dose: { index: 0, dosage, text: key } }),
    answer: null,
  };
  return { kind: 'item', item };
};

const keyOf = (journalRow: JournalRow) =>
  journalRow.kind === 'bundle' ? journalRow.key : journalRow.item.key;

const describe = (groups: ReturnType<typeof groupJournalRows>) =>
  Object.fromEntries(groups.map((group) => [group.id, group.rows.map(keyOf)]));

test('rows group by part of the day, in clock order, any time last', () => {
  const groups = groupJournalRows(
    [
      row('a'),
      row('b', 'EVE'),
      row('c', 'MORN'),
      row('d', '07:30'),
      row('e', 'MORN', 'EVE'),
      row('f', 'C'),
    ],
    DEFAULT_TIMES_OF_DAY
  );
  expect(groups.map((group) => group.label)).toEqual([
    '07:30',
    'Morning',
    'Evening',
    'Any time',
  ]);
  // An exact time has a group of its own, here before Morning (08:00).
  expect(describe(groups)).toEqual({
    '07:30': ['d-07:30'],
    MORN: ['c-MORN'],
    EVE: ['b-EVE'],
    any: ['a-any', 'e-MORN+EVE', 'f-C'],
  });
});

test('each exact time is a group of its own, in clock order', () => {
  const groups = groupJournalRows(
    [
      row('a', '10:00'),
      row('b', 'NOON'),
      row('c', '13:00'),
      row('d', '03:00'),
      row('e', '10:00'),
    ],
    { ...DEFAULT_TIMES_OF_DAY, NOON: '13:00' }
  );
  // A part of the day comes before an exact time at the same minute.
  expect(groups.map((group) => group.label)).toEqual([
    '03:00',
    '10:00',
    'Noon',
    '13:00',
  ]);
  expect(describe(groups)).toEqual({
    '03:00': ['d-03:00'],
    '10:00': ['a-10:00', 'e-10:00'],
    NOON: ['b-NOON'],
    '13:00': ['c-13:00'],
  });
});

test('parts of the day follow their clock times', () => {
  const groups = groupJournalRows([row('a', 'MORN'), row('b', 'NOON')], {
    ...DEFAULT_TIMES_OF_DAY,
    NOON: '06:00',
  });
  expect(groups.map((group) => group.id)).toEqual(['NOON', 'MORN']);
});

test('bundle times group by their part of the day', () => {
  const bundle = buildBundle(
    {
      title: 'x',
      memberIds: ['a'],
      times: [{ kind: 'when', code: 'EVE' }],
    },
    { id: 'x', patientId: 'p1', now: new Date('2026-10-19T08:00:00Z') }
  );
  const dose = row('a', 'EVE') as Extract<JournalRow, { kind: 'item' }>;
  const rows = groupActionDay([dose.item], [bundle], DEFAULT_TIMES_OF_DAY);
  expect(describe(groupJournalRows(rows, DEFAULT_TIMES_OF_DAY))).toEqual({
    EVE: ['x:0'],
  });
});

test("the user's order comes first; new resources follow, kept together", () => {
  const rows = [row('a', 'MORN'), row('b', 'MORN'), row('c'), row('b')];
  expect(
    applyJournalOrder(rows, ['MedicationRequest/b', 'MedicationRequest/x']).map(
      keyOf
    )
  ).toEqual(['b-MORN', 'b-any', 'a-MORN', 'c-any']);
});

test('moving swaps neighbouring resources and keeps others in place', () => {
  const rows = [row('a'), row('b'), row('b'), row('c')];
  expect(canMoveJournalRow(rows, 0, -1)).toBe(false);
  expect(canMoveJournalRow(rows, 2, 1)).toBe(true);
  expect(canMoveJournalRow(rows, 3, 1)).toBe(false);
  // Rows of b move together, past c.
  expect(moveJournalRow(rows, 1, 1)).toEqual([
    'MedicationRequest/a',
    'MedicationRequest/c',
    'MedicationRequest/b',
  ]);
  // x is not shown that day and keeps its place.
  expect(
    moveJournalRow(rows, 3, -1, [
      'MedicationRequest/x',
      'MedicationRequest/a',
      'MedicationRequest/b',
    ])
  ).toEqual([
    'MedicationRequest/x',
    'MedicationRequest/a',
    'MedicationRequest/c',
    'MedicationRequest/b',
  ]);
});

test('a move applies to the rows grouped next time', () => {
  const rows = [row('a', 'MORN'), row('b', 'MORN'), row('c', 'EVE')];
  const [morning] = groupJournalRows(rows, DEFAULT_TIMES_OF_DAY);
  const order = { MORN: moveJournalRow(morning.rows, 1, -1) };
  expect(describe(groupJournalRows(rows, DEFAULT_TIMES_OF_DAY, order))).toEqual(
    { MORN: ['b-MORN', 'a-MORN'], EVE: ['c-EVE'] }
  );
});
