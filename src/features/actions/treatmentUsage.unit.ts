import { test, expect } from '@playwright/test';
import type { Dosage, MedicationRequest, MedicationStatement } from 'fhir/r5';
import {
  buildUsageStatement,
  getCurrentUsage,
  getFirstTakingDay,
  getLatestRegimen,
  getRegimenOn,
  getUsagePeriods,
  isTakingOn,
  planUsageChange,
  planUsageRemoval,
  type UsageAction,
  type UsageChangePlan,
} from './treatmentUsage';

const treatment: MedicationRequest = {
  resourceType: 'MedicationRequest',
  id: 'vit-d',
  status: 'active',
  intent: 'plan',
  subject: { reference: 'Patient/p1' },
  medication: { concept: { text: 'Vitamin D' } },
};
const TODAY = '2026-10-16';

/** Applies a plan to a set of statements, as the service does. */
function apply(
  statements: MedicationStatement[],
  plan: UsageChangePlan | { error: string }
): MedicationStatement[] {
  if ('error' in plan) throw new Error(plan.error);
  const saved = new Map(statements.map((s) => [s.id, s]));
  for (const id of plan.remove) saved.delete(id);
  for (const statement of plan.save) saved.set(statement.id, statement);
  return [...saved.values()];
}

/** Runs usage changes in order and returns the resulting statements. */
function run(
  changes: [UsageAction, string, Dosage[]?][]
): MedicationStatement[] {
  return changes.reduce(
    (statements, [action, date, dosage], index) =>
      apply(
        statements,
        planUsageChange(
          getUsagePeriods(statements, 'vit-d'),
          action,
          date,
          TODAY,
          `use-${index}`,
          treatment,
          'p1',
          undefined,
          undefined,
          dosage
        )
      ),
    [] as MedicationStatement[]
  );
}

const summary = (statements: MedicationStatement[]) =>
  getUsagePeriods(statements, 'vit-d').map(({ state, start, end }) =>
    [state, start, end ?? null].join(' ')
  );

test('changes close the current period the day before the next starts', () => {
  const statements = run([
    ['start', '2026-10-01'],
    ['pause', '2026-10-08'],
    ['resume', '2026-10-10'],
    ['stop', '2026-10-14'],
  ]);
  expect(summary(statements)).toEqual([
    'taking 2026-10-01 2026-10-07',
    'on-hold 2026-10-08 2026-10-09',
    'taking 2026-10-10 2026-10-13',
    'stopped 2026-10-14 ',
  ]);
  const periods = getUsagePeriods(statements, 'vit-d');
  expect(getCurrentUsage(periods)).toBe('stopped');
  expect(getFirstTakingDay(periods)).toBe('2026-10-01');
  expect(isTakingOn(periods, '2026-09-30')).toBe(false);
  expect(isTakingOn(periods, '2026-10-07')).toBe(true);
  expect(isTakingOn(periods, '2026-10-08')).toBe(false);
  expect(isTakingOn(periods, '2026-10-13')).toBe(true);
  expect(isTakingOn(periods, '2026-10-14')).toBe(false);
});

test('statements are FHIR R5 MedicationStatements derived from the treatment', () => {
  const statement = buildUsageStatement(
    treatment,
    'p1',
    'on-hold',
    '2026-10-05',
    'use-1',
    undefined,
    'Waiting for a refill'
  );
  expect(statement).toMatchObject({
    resourceType: 'MedicationStatement',
    status: 'recorded',
    medication: { concept: { text: 'Vitamin D' } },
    subject: { reference: 'Patient/p1' },
    derivedFrom: [{ reference: 'MedicationRequest/vit-d' }],
    effectivePeriod: { start: '2026-10-05' },
    adherence: {
      code: {
        coding: [
          {
            system:
              'http://hl7.org/fhir/CodeSystem/medication-statement-adherence',
            code: 'on-hold',
          },
        ],
      },
    },
    note: [{ text: 'Waiting for a refill' }],
  });
});

test('a change on the current period first day replaces it', () => {
  expect(
    summary(
      run([
        ['start', '2026-10-01'],
        ['pause', '2026-10-05'],
        ['resume', '2026-10-05'],
      ])
    )
  ).toEqual(['taking 2026-10-01 2026-10-04', 'taking 2026-10-05 ']);
});

test('dates in the future or before the current period are rejected', () => {
  const periods = getUsagePeriods(run([['start', '2026-10-05']]), 'vit-d');
  const plan = (date: string) =>
    planUsageChange(periods, 'pause', date, TODAY, 'x', treatment, 'p1');
  expect(plan('2026-10-17')).toEqual({
    error: 'The date cannot be in the future',
  });
  expect(plan('2026-10-04')).toEqual({
    error: 'The date cannot be before 2026-10-05',
  });
});

test('removing a period closes the gap it leaves', () => {
  const statements = run([
    ['start', '2026-10-01'],
    ['pause', '2026-10-08'],
    ['resume', '2026-10-10'],
  ]);
  const periods = getUsagePeriods(statements, 'vit-d');
  // Between two taking periods: they merge into one, still open.
  expect(
    summary(apply(statements, planUsageRemoval(periods, 'use-1')))
  ).toEqual(['taking 2026-10-01 ']);
  // The current one: the period before it reopens.
  expect(
    summary(apply(statements, planUsageRemoval(periods, 'use-2')))
  ).toEqual(['taking 2026-10-01 2026-10-07', 'on-hold 2026-10-08 ']);
  // The first one: the rest is unchanged.
  expect(
    summary(apply(statements, planUsageRemoval(periods, 'use-0')))
  ).toEqual(['on-hold 2026-10-08 2026-10-09', 'taking 2026-10-10 ']);
});

test('imported adherence codes are grouped and other treatments ignored', () => {
  const imported = {
    ...buildUsageStatement(treatment, 'p1', 'taking', '2026-10-01', 'a'),
    adherence: {
      code: {
        coding: [
          {
            system:
              'http://hl7.org/fhir/CodeSystem/medication-statement-adherence',
            code: 'taking-as-directed',
            display: 'Taking As Directed',
          },
        ],
      },
    },
  } as MedicationStatement;
  const other = buildUsageStatement(
    { ...treatment, id: 'other' },
    'p1',
    'taking',
    '2026-10-01',
    'b'
  );
  const periods = getUsagePeriods([imported, other], 'vit-d');
  expect(periods.map(({ state, label }) => [state, label])).toEqual([
    ['taking', 'Taking As Directed'],
  ]);
  expect(getCurrentUsage([])).toBe('not-started');
});

const ONE: Dosage[] = [{ text: '1 capsule daily' }];
const TWO: Dosage[] = [{ text: '2 capsules daily' }];
const regimens = (statements: MedicationStatement[]) =>
  getUsagePeriods(statements, 'vit-d').map(
    ({ state, dosage }) => `${state} ${dosage?.[0]?.text ?? '-'}`
  );

test('a new regimen starts a taking period; on its first day it replaces it', () => {
  const changed = run([
    ['start', '2026-10-01', ONE],
    ['pause', '2026-10-04'],
    ['resume', '2026-10-06', ONE],
    ['change', '2026-10-09', TWO],
  ]);
  expect(summary(changed)).toEqual([
    'taking 2026-10-01 2026-10-03',
    'on-hold 2026-10-04 2026-10-05',
    'taking 2026-10-06 2026-10-08',
    'taking 2026-10-09 ',
  ]);
  // Only periods of taking it record a regimen.
  expect(regimens(changed)).toEqual([
    'taking 1 capsule daily',
    'on-hold -',
    'taking 1 capsule daily',
    'taking 2 capsules daily',
  ]);
  expect(
    summary(
      run([
        ['start', '2026-10-01', ONE],
        ['change', '2026-10-01', TWO],
      ])
    )
  ).toEqual(['taking 2026-10-01 ']);
  const paused = getUsagePeriods(
    run([
      ['start', '2026-10-01', ONE],
      ['pause', '2026-10-04'],
    ]),
    'vit-d'
  );
  expect(
    planUsageChange(paused, 'change', TODAY, TODAY, 'x', treatment, 'p1')
  ).toEqual({ error: 'A new regimen needs the treatment to be taken' });
});

test('each day follows the regimen of its period, counted from that regimen start', () => {
  const prescribed = { ...treatment, dosageInstruction: ONE };
  const periods = getUsagePeriods(
    run([
      ['start', '2026-10-01', ONE],
      ['pause', '2026-10-04'],
      ['resume', '2026-10-06', ONE],
      ['change', '2026-10-09', TWO],
    ]),
    'vit-d'
  );
  // A pause does not restart the regimen; a new one does.
  expect(getRegimenOn(periods, '2026-10-07', prescribed)).toEqual({
    dosage: ONE,
    start: '2026-10-01',
  });
  expect(getRegimenOn(periods, '2026-10-12', prescribed)).toEqual({
    dosage: TWO,
    start: '2026-10-09',
  });
  expect(getLatestRegimen(periods, prescribed)).toEqual(TWO);
  // A period without a recorded regimen follows the prescription.
  const unrecorded = getUsagePeriods(run([['start', '2026-10-01']]), 'vit-d');
  expect(getRegimenOn(unrecorded, '2026-10-02', prescribed)).toEqual({
    dosage: ONE,
    start: '2026-10-01',
  });
  expect(getLatestRegimen([], prescribed)).toEqual(ONE);
});

test('removing a period between two regimens keeps both', () => {
  const statements = run([
    ['start', '2026-10-01', ONE],
    ['pause', '2026-10-04'],
    ['resume', '2026-10-06', TWO],
  ]);
  const periods = getUsagePeriods(statements, 'vit-d');
  const removed = apply(statements, planUsageRemoval(periods, 'use-1'));
  expect(summary(removed)).toEqual([
    'taking 2026-10-01 2026-10-05',
    'taking 2026-10-06 ',
  ]);
  expect(regimens(removed)).toEqual([
    'taking 1 capsule daily',
    'taking 2 capsules daily',
  ]);
});
