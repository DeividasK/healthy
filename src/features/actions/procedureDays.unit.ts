import { expect, test } from '@playwright/test';
import type { Procedure, ServiceRequest } from 'fhir/r5';
import { getDayStatus } from './actionDays';
import {
  addPeriod,
  buildProcedureItems,
  getProcedureDuration,
} from './procedureDays';

const request = (
  repeat: NonNullable<ServiceRequest['occurrenceTiming']>['repeat'],
  overrides: Partial<ServiceRequest> = {}
): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id: 'sr',
  status: 'active',
  intent: 'plan',
  subject: { reference: 'Patient/p' },
  authoredOn: '2026-09-01',
  occurrenceTiming: { repeat },
  ...overrides,
});

const log = (
  date: string,
  status: Procedure['status'] = 'completed'
): Procedure => ({
  resourceType: 'Procedure',
  id: `sr-${date}`,
  status,
  subject: { reference: 'Patient/p' },
  basedOn: [{ reference: 'ServiceRequest/sr' }],
  occurrenceDateTime: date,
});

const PRP = request({ period: 4, periodMax: 6, periodUnit: 'wk', count: 3 });

test('a daily activity is due every day from its start', () => {
  const daily = request({ frequency: 1, period: 1, periodUnit: 'd' });
  expect(buildProcedureItems('2026-08-31', [daily], [])).toEqual([]);
  const [item] = buildProcedureItems(
    '2026-09-10',
    [daily],
    [log('2026-09-09')]
  );
  expect(item).toMatchObject({ key: 'sr-2026-09-10', answer: null });
  // A daily schedule shows no due window.
  expect(item.due).toBeUndefined();
});

test('the next session is due once the interval has passed', () => {
  const logs = [log('2026-09-01')];
  expect(buildProcedureItems('2026-09-28', [PRP], logs)).toEqual([]);
  const [item] = buildProcedureItems('2026-09-29', [PRP], logs);
  expect(item.session).toEqual({ number: 2, count: 3 });
  expect(item.due).toEqual({ from: '2026-09-29', to: '2026-10-13' });
  // Overdue sessions stay asked for.
  expect(buildProcedureItems('2026-12-01', [PRP], logs)).toHaveLength(1);
});

test('not-done answers are not sessions', () => {
  const logs = [log('2026-09-01'), log('2026-09-30', 'not-done')];
  const [item] = buildProcedureItems('2026-10-01', [PRP], logs);
  expect(item.session).toEqual({ number: 2, count: 3 });
});

test('the answered day stays listed, and nothing is due after the last session', () => {
  const logs = [log('2026-09-01'), log('2026-09-29'), log('2026-10-27')];
  const [answered] = buildProcedureItems('2026-10-27', [PRP], logs);
  expect(answered).toMatchObject({
    answer: 'taken',
    session: { number: 3, count: 3 },
  });
  expect(buildProcedureItems('2026-12-30', [PRP], logs)).toEqual([]);
});

test('a completed or revoked request is no longer due', () => {
  for (const status of ['completed', 'revoked'] as const)
    expect(buildProcedureItems('2026-09-02', [{ ...PRP, status }], [])).toEqual(
      []
    );
});

test('requests without a repeating schedule are never due', () => {
  const planned = request(undefined, {
    occurrenceTiming: undefined,
    occurrenceDateTime: '2026-09-02',
  });
  expect(buildProcedureItems('2026-09-02', [planned], [])).toEqual([]);
});

test('planned duration is carried on the item', () => {
  const reading = request({
    period: 1,
    periodUnit: 'd',
    duration: 0.5,
    durationUnit: 'h',
  });
  expect(buildProcedureItems('2026-09-02', [reading], [])[0]).toMatchObject({
    plannedDuration: 30,
  });
});

test('months end on the last day of a shorter month', () => {
  expect(addPeriod('2026-01-31', 1, 'mo')).toBe('2026-02-28');
  expect(addPeriod('2026-10-15', 2, 'mo')).toBe('2026-12-15');
  expect(addPeriod('2026-10-15', 2, 'wk')).toBe('2026-10-29');
});

test('duration comes from the timing or a timed period', () => {
  expect(
    getProcedureDuration({
      ...log('2026-09-01'),
      occurrenceDateTime: undefined,
      occurrenceTiming: {
        event: ['2026-09-01'],
        repeat: { duration: 35, durationUnit: 'min' },
      },
    })
  ).toBe(35);
  expect(
    getProcedureDuration({
      ...log('2026-09-01'),
      occurrenceDateTime: undefined,
      occurrencePeriod: {
        start: '2026-09-01T22:00:00+01:00',
        end: '2026-09-01T22:40:00+01:00',
      },
    })
  ).toBe(40);
  expect(getProcedureDuration(log('2026-09-01'))).toBeNull();
});

test('sessions with no interval are listed every day until all are done, as optional', () => {
  const physio = request({ count: 2, duration: 45, durationUnit: 'min' });
  const [first] = buildProcedureItems('2026-09-02', [physio], []);
  expect(first).toMatchObject({
    optional: true,
    session: { number: 1, count: 2 },
    plannedDuration: 45,
  });
  expect(first.due).toBeUndefined();
  // Unanswered, it leaves the day with nothing else to log complete.
  expect(
    getDayStatus({ date: '2026-09-02', items: [], procedures: [first] })
  ).toBe('none');
  // The next day it is listed again, as the next session.
  const logs = [log('2026-09-02')];
  const [next] = buildProcedureItems('2026-09-03', [physio], logs);
  expect(next.session).toEqual({ number: 2, count: 2 });
  const [answered] = buildProcedureItems('2026-09-02', [physio], logs);
  expect(
    getDayStatus({ date: '2026-09-02', items: [], procedures: [answered] })
  ).toBe('complete');
  // Once every session is done, it is no longer listed.
  logs.push(log('2026-09-03'));
  expect(buildProcedureItems('2026-09-04', [physio], logs)).toEqual([]);
});
