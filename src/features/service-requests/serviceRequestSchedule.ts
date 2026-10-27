import type { ServiceRequest, TimingRepeat } from 'fhir/r5';
import {
  SPECIFIC_TIME,
  formatClockTime,
  formatTimePhrase,
  getWhenLabel,
} from '@/src/features/treatments/regimen';

/**
 * A repeating service request (e.g. 3 PRP sessions every 4–6 weeks, or 30
 * minutes of reading every day) keeps its schedule in
 * `occurrenceTiming.repeat`: `period`, `periodMax` and `periodUnit` for how
 * often, `count` for how many times, `duration` (minutes) for how long, and
 * `when` or `timeOfDay` for the time of day. Other timing elements are kept.
 */

export type ScheduleUnit = 'd' | 'wk' | 'mo';

/** What the service request form sets on the schedule. */
export interface ServiceRequestSchedule {
  period: number;
  periodMax?: number | null;
  periodUnit: ScheduleUnit;
  count?: number | null;
  /** Minutes each time. */
  duration?: number | null;
  /** A `when` code (comma-joined to keep several), or null. */
  when?: string | null;
  /** An exact clock time (HH:mm), or null. */
  timeOfDay?: string | null;
}

/** Form values for the schedule's fields, as text. */
export interface ScheduleDraft {
  period: string;
  periodUnit: string;
  periodMax: string;
  count: string;
  duration: string;
  /** A `when` code, or `SPECIFIC_TIME` with `time`. */
  timeChoice: string;
  time: string;
}

const UNIT_LABELS: Record<ScheduleUnit, [string, string]> = {
  d: ['day', 'days'],
  wk: ['week', 'weeks'],
  mo: ['month', 'months'],
};

const isScheduleUnit = (unit?: string): unit is ScheduleUnit =>
  Boolean(unit && unit in UNIT_LABELS);

/** The request's repeat, when it has a schedule. */
export const getScheduleRepeat = (
  request: ServiceRequest
): TimingRepeat | undefined =>
  request.occurrenceTiming?.repeat?.period
    ? request.occurrenceTiming.repeat
    : undefined;

const toMinutes = (repeat: TimingRepeat) =>
  repeat.duration === undefined
    ? undefined
    : repeat.durationUnit === 'h'
      ? repeat.duration * 60
      : repeat.durationUnit === 'min'
        ? repeat.duration
        : undefined;

/** e.g. "3 sessions, every 4–6 weeks" or "Every day". */
export function formatScheduleRepeat(repeat: TimingRepeat): string | null {
  const { period, periodMax, periodUnit, count } = repeat;
  if (!period || !isScheduleUnit(periodUnit)) return null;
  const [singular, plural] = UNIT_LABELS[periodUnit];
  const every =
    periodMax && periodMax !== period
      ? `every ${period}–${periodMax} ${plural}`
      : period === 1
        ? `every ${singular}`
        : `every ${period} ${plural}`;
  if (!count) return every[0].toUpperCase() + every.slice(1);
  return `${count} ${count === 1 ? 'session' : 'sessions'}, ${every}`;
}

/** e.g. "30 min". */
export const formatMinutes = (minutes: number) => `${minutes} min`;

/** The planned minutes each time, e.g. "30 min". */
export function formatScheduleDuration(repeat: TimingRepeat): string | null {
  const minutes = toMinutes(repeat);
  return minutes === undefined ? null : formatMinutes(minutes);
}

/**
 * The schedule in words, worded like a treatment's dose: e.g. "10 min in the
 * evening", "45 min, every 2 days" or "3 sessions, every 4–6 weeks".
 * `withoutTime` leaves out the time of day, e.g. under a bundle's time.
 */
export function formatScheduleText(
  repeat: TimingRepeat,
  { withoutTime = false }: { withoutTime?: boolean } = {}
): string | null {
  const { period, periodMax, periodUnit, count } = repeat;
  if (!period || !isScheduleUnit(periodUnit)) return null;
  const [singular, plural] = UNIT_LABELS[periodUnit];
  const duration = formatScheduleDuration(repeat);
  const time = withoutTime ? undefined : formatTimePhrase(repeat);
  const frequency =
    periodMax && periodMax !== period
      ? `every ${period}–${periodMax} ${plural}`
      : period === 1
        ? `once a ${singular}`
        : `every ${period} ${plural}`;
  // A time of day, or a heading showing one, implies once a day:
  // "10 min in the evening", or "10 min" under an Evening bundle.
  const isDailyAtTime =
    period === 1 && periodUnit === 'd' && !periodMax && (!!time || withoutTime);
  const parts = isDailyAtTime
    ? [
        count && `${count} ${count === 1 ? 'session' : 'sessions'}`,
        [duration, time].filter(Boolean).join(' '),
      ]
    : [
        count && `${count} ${count === 1 ? 'session' : 'sessions'}`,
        duration,
        frequency,
        time,
      ];
  const text = parts.filter(Boolean).join(', ') || frequency;
  return text[0].toUpperCase() + text.slice(1);
}

/** e.g. "Before bed" or "07:30". */
export function formatScheduleTime(repeat: TimingRepeat): string | null {
  if (repeat.when?.length) return repeat.when.map(getWhenLabel).join(', ');
  if (repeat.timeOfDay?.length)
    return repeat.timeOfDay.map(formatClockTime).join(', ');
  return null;
}

/** The form's draft for a stored schedule (empty fields when none). */
export function toScheduleDraft(request?: ServiceRequest): ScheduleDraft {
  const repeat = request && getScheduleRepeat(request);
  const text = (value?: number) => (value === undefined ? '' : String(value));
  return {
    period: text(repeat?.period),
    periodUnit: repeat?.periodUnit ?? 'd',
    periodMax: text(repeat?.periodMax),
    count: text(repeat?.count),
    duration: text(repeat && toMinutes(repeat)),
    timeChoice: repeat?.timeOfDay?.length
      ? SPECIFIC_TIME
      : (repeat?.when?.join(',') ?? ''),
    time: repeat?.timeOfDay?.length
      ? formatClockTime(repeat.timeOfDay[0])
      : '08:00',
  };
}

const parseNumber = (text: string) => {
  const trimmed = text.trim().replace(',', '.');
  return trimmed ? Number(trimmed) : null;
};

/**
 * The schedule for the form's shown fields, or an error message. Hidden
 * fields are cleared.
 */
export function parseScheduleDraft(
  draft: ScheduleDraft,
  shown: {
    periodMax: boolean;
    count: boolean;
    duration: boolean;
    timeOfDay: boolean;
  }
): ServiceRequestSchedule | string {
  const period = parseNumber(draft.period);
  if (period === null || !Number.isFinite(period) || period <= 0)
    return 'Repeats every must be more than 0';
  if (!isScheduleUnit(draft.periodUnit)) return 'Choose how often it repeats';
  const periodMax = shown.periodMax ? parseNumber(draft.periodMax) : null;
  if (periodMax !== null && !(periodMax >= period))
    return 'Up to must be at least the repeat interval';
  const count = shown.count ? parseNumber(draft.count) : null;
  if (count !== null && !(Number.isInteger(count) && count > 0))
    return 'Sessions must be a whole number above 0';
  const duration = shown.duration ? parseNumber(draft.duration) : null;
  if (duration !== null && !(Number.isFinite(duration) && duration >= 0))
    return 'Duration must be 0 minutes or more';
  const isTime = shown.timeOfDay && draft.timeChoice === SPECIFIC_TIME;
  return {
    period,
    periodMax,
    periodUnit: draft.periodUnit,
    count,
    duration,
    when: shown.timeOfDay && !isTime ? draft.timeChoice || null : null,
    timeOfDay: isTime ? draft.time : null,
  };
}

/**
 * The repeat with the schedule's values. Elements the form does not show are
 * kept; a new repeat happens once per period (`frequency: 1`).
 */
export function withSchedule(
  existing: TimingRepeat | undefined,
  schedule: ServiceRequestSchedule
): TimingRepeat {
  const repeat: TimingRepeat = existing ? { ...existing } : { frequency: 1 };
  repeat.period = schedule.period;
  repeat.periodUnit = schedule.periodUnit;
  const set = <K extends keyof TimingRepeat>(
    key: K,
    value: TimingRepeat[K] | null | undefined
  ) => {
    if (value === null || value === undefined) delete repeat[key];
    else repeat[key] = value;
  };
  set('periodMax', schedule.periodMax);
  set('count', schedule.count);
  set('duration', schedule.duration);
  set('durationUnit', schedule.duration == null ? null : 'min');
  // An unchanged set of codes keeps them all; a time replaces `when` (tim-10).
  if (schedule.timeOfDay) {
    delete repeat.when;
    const others = existing?.timeOfDay?.slice(1) ?? [];
    repeat.timeOfDay = [`${schedule.timeOfDay}:00`, ...others];
  } else {
    delete repeat.timeOfDay;
    set(
      'when',
      schedule.when
        ? (schedule.when.split(',') as NonNullable<TimingRepeat['when']>)
        : null
    );
  }
  return repeat;
}
