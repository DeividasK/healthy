import { expect, test } from '@playwright/test';
import {
  formatScheduleRepeat,
  formatScheduleText,
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
  period: true,
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

test('words schedules like treatment doses', () => {
  const daily = {
    period: 1,
    periodUnit: 'd' as const,
    duration: 10,
    durationUnit: 'min' as const,
  };
  expect(formatScheduleText({ ...daily, when: ['EVE'] })).toBe(
    '10 min in the evening'
  );
  expect(formatScheduleText({ ...daily, timeOfDay: ['07:30:00'] })).toBe(
    '10 min at 07:30'
  );
  expect(formatScheduleText(daily)).toBe('10 min, once a day');
  // Under a time heading, the time and the daily repeat go unsaid.
  expect(
    formatScheduleText({ ...daily, when: ['EVE'] }, { withoutTime: true })
  ).toBe('10 min');
  expect(
    formatScheduleText({
      period: 2,
      periodUnit: 'd',
      duration: 45,
      durationUnit: 'min',
      when: ['MORN'],
    })
  ).toBe('45 min, every 2 days, in the morning');
  expect(
    formatScheduleText({ period: 4, periodMax: 6, periodUnit: 'wk', count: 3 })
  ).toBe('3 sessions, every 4–6 weeks');
  expect(formatScheduleText({ period: 1, periodUnit: 'wk' })).toBe(
    'Once a week'
  );
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
      period: true,
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

test('sessions with no set interval', () => {
  const sessions = { ...draft, period: '', periodUnit: '' };
  const shown = { ...allShown, period: false, timeOfDay: false };
  const schedule = parseScheduleDraft(sessions, shown);
  expect(schedule).toMatchObject({
    period: null,
    periodMax: null,
    periodUnit: null,
    count: 3,
    duration: 30,
  });
  expect(parseScheduleDraft({ ...sessions, count: '' }, shown)).toBe(
    'Add how often it repeats or how many sessions'
  );
  expect(parseScheduleDraft(sessions, { ...shown, count: false })).toBe(
    'Add how often it repeats or how many sessions'
  );

  // An interval removed from a stored schedule takes its frequency with it.
  const repeat = withSchedule(
    { frequency: 1, period: 4, periodMax: 6, periodUnit: 'wk', count: 3 },
    schedule as Exclude<typeof schedule, string>
  );
  expect(repeat).toEqual({ count: 3, duration: 30, durationUnit: 'min' });
  expect(formatScheduleRepeat(repeat)).toBe('3 sessions');
  expect(formatScheduleText(repeat)).toBe('3 sessions, 30 min');
  expect(formatScheduleText({ count: 1 })).toBe('1 session');
  expect(formatScheduleText({})).toBeNull();
});
