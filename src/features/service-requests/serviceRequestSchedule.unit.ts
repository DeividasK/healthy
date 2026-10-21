import { expect, test } from '@playwright/test';
import {
  formatScheduleRepeat,
  parseScheduleDraft,
  withSchedule,
} from './serviceRequestSchedule';

const draft = {
  period: '4',
  periodUnit: 'wk',
  periodMax: '6',
  count: '3',
  duration: '30',
  timeChoice: 'HS',
  time: '08:00',
};
const allShown = {
  periodMax: true,
  count: true,
  duration: true,
  timeOfDay: true,
};

test('formats schedules', () => {
  expect(
    formatScheduleRepeat({
      period: 4,
      periodMax: 6,
      periodUnit: 'wk',
      count: 3,
    })
  ).toBe('3 sessions, every 4–6 weeks');
  expect(formatScheduleRepeat({ period: 1, periodUnit: 'd' })).toBe(
    'Every day'
  );
  expect(formatScheduleRepeat({ period: 2, periodUnit: 'mo' })).toBe(
    'Every 2 months'
  );
  expect(formatScheduleRepeat({ period: 1, periodUnit: 'h' })).toBeNull();
});

test('parses shown fields and clears hidden ones', () => {
  expect(parseScheduleDraft(draft, allShown)).toEqual({
    period: 4,
    periodMax: 6,
    periodUnit: 'wk',
    count: 3,
    duration: 30,
    when: 'HS',
    timeOfDay: null,
  });
  expect(
    parseScheduleDraft(draft, {
      periodMax: false,
      count: false,
      duration: false,
      timeOfDay: false,
    })
  ).toMatchObject({ periodMax: null, count: null, duration: null, when: null });
});

test('rejects invalid values', () => {
  expect(parseScheduleDraft({ ...draft, period: '0' }, allShown)).toBe(
    'Repeats every must be more than 0'
  );
  expect(parseScheduleDraft({ ...draft, periodMax: '2' }, allShown)).toBe(
    'Up to must be at least the repeat interval'
  );
  expect(parseScheduleDraft({ ...draft, count: '1.5' }, allShown)).toBe(
    'Sessions must be a whole number above 0'
  );
});

test('keeps elements the form does not show', () => {
  const repeat = withSchedule(
    {
      frequency: 2,
      period: 1,
      periodUnit: 'd',
      boundsPeriod: { start: '2026-09-01' },
      when: ['MORN'],
    },
    {
      period: 1,
      periodUnit: 'd',
      duration: 10,
      timeOfDay: '07:30',
    }
  );
  expect(repeat).toEqual({
    frequency: 2,
    period: 1,
    periodUnit: 'd',
    boundsPeriod: { start: '2026-09-01' },
    duration: 10,
    durationUnit: 'min',
    timeOfDay: ['07:30:00'],
  });
  // A new schedule happens once per period.
  expect(withSchedule(undefined, { period: 4, periodUnit: 'wk' })).toEqual({
    frequency: 1,
    period: 4,
    periodUnit: 'wk',
  });
});
