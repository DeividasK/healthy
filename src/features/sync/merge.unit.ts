import { test, expect } from '@playwright/test';
import { orderForApply, selectWinners } from './merge';
import { changeKey, type SyncChange } from './types';

const change = (
  hlc: string,
  op: 'put' | 'delete',
  resourceType: SyncChange['resourceType'] = 'Condition',
  id = 'c1'
): SyncChange => ({
  hlc,
  resourceType,
  id,
  patientId: 'p1',
  op,
  ...(op === 'put' ? { resource: { resourceType, id, note: hlc } } : {}),
});

const state = (changes: SyncChange[]) =>
  Object.fromEntries(selectWinners(changes).map((c) => [changeKey(c), c.hlc]));

const history = [
  change('0000000000001-0000-a', 'put'),
  change('0000000000003-0000-b', 'delete'),
  change('0000000000002-0000-a', 'put'),
  change('0000000000004-0000-a', 'put', 'Patient', 'p1'),
  change('0000000000005-0000-b', 'put', 'Encounter', 'e1'),
];

test('merging is order-independent and idempotent', () => {
  const expected = state(history);
  for (let i = 0; i < 20; i++) {
    const shuffled = [...history, ...history].sort(() => Math.random() - 0.5);
    expect(state(shuffled)).toEqual(expected);
  }
  expect(state([...history, ...selectWinners(history)])).toEqual(expected);
});

test('a tombstone beats an older put and a newer put beats a tombstone', () => {
  expect(selectWinners(history.slice(0, 3))[0].op).toBe('delete');
  const resurrected = selectWinners([
    ...history.slice(0, 3),
    change('0000000000009-0000-c', 'put'),
  ]);
  expect(resurrected[0].op).toBe('put');
});

test('applies parents before children and deletes children first', () => {
  const ordered = orderForApply([
    change('0000000000001-0000-a', 'put', 'Composition', 'd1'),
    change('0000000000002-0000-a', 'delete', 'Patient', 'p2'),
    change('0000000000003-0000-a', 'put', 'Encounter', 'e1'),
    change('0000000000004-0000-a', 'delete', 'Condition', 'c2'),
    change('0000000000005-0000-a', 'put', 'Patient', 'p1'),
  ]);
  expect(ordered.map((c) => `${c.op}:${c.resourceType}`)).toEqual([
    'put:Patient',
    'put:Encounter',
    'put:Composition',
    'delete:Condition',
    'delete:Patient',
  ]);
});
