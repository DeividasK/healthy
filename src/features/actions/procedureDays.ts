import type { Procedure, ServiceRequest, TimingRepeat } from 'fhir/r5';
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from '@/src/utils/dateUtils';
import type { TreatmentLogAnswer } from './actionDays';

/**
 * Scheduled service requests (procedures and activities repeated on a
 * schedule) are logged in the journal as FHIR R5 Procedures, one per request
 * and day, based on the request (`basedOn`).
 */

type ScheduleUnit = 'd' | 'wk' | 'mo';
const SCHEDULE_UNITS: ScheduleUnit[] = ['d', 'wk', 'mo'];

/** How often a service request repeats (its `occurrenceTiming.repeat`). */
export interface RequestSchedule {
  period: number;
  periodMax?: number;
  unit: ScheduleUnit;
  /** How many times in all, when limited. */
  count?: number;
  /** Planned minutes each time. */
  duration?: number;
  /** First day it can be due. */
  start: string;
}

/** Statuses a scheduled request is still due in. */
const DUE_STATUSES: ServiceRequest['status'][] = ['active', 'unknown'];

const toMinutes = (value?: number, unit?: TimingRepeat['durationUnit']) => {
  if (value === undefined) return undefined;
  if (unit === 'min') return value;
  if (unit === 'h') return value * 60;
  if (unit === 's') return value / 60;
  return undefined;
};

/** The request's repeating schedule, or null when it has none. */
export function getRequestSchedule(
  request: ServiceRequest
): RequestSchedule | null {
  const repeat = request.occurrenceTiming?.repeat;
  const unit = repeat?.periodUnit as ScheduleUnit | undefined;
  if (!repeat?.period || repeat.period <= 0 || !unit) return null;
  if (!SCHEDULE_UNITS.includes(unit)) return null;
  const start = (repeat.boundsPeriod?.start ?? request.authoredOn)?.slice(
    0,
    10
  );
  if (!start) return null;
  return {
    period: repeat.period,
    ...(repeat.periodMax && { periodMax: repeat.periodMax }),
    unit,
    ...(repeat.count && { count: repeat.count }),
    ...(repeat.duration !== undefined && {
      duration: toMinutes(repeat.duration, repeat.durationUnit),
    }),
    start,
  };
}

/** The day `amount` units after `date`. */
export function addPeriod(
  date: string,
  amount: number,
  unit: ScheduleUnit
): string {
  if (unit === 'd') return addDays(date, Math.round(amount));
  if (unit === 'wk') return addDays(date, Math.round(amount * 7));
  const day = parseLocalDate(date);
  const target = day.getMonth() + Math.round(amount);
  day.setMonth(target);
  // A shorter month ends on its last day, not in the next month.
  if (((day.getMonth() % 12) + 12) % 12 !== ((target % 12) + 12) % 12)
    day.setDate(0);
  return formatLocalDate(day);
}

/** The local day (YYYY-MM-DD) a procedure log is recorded for. */
export function getProcedureDate(procedure: Procedure): string | null {
  const value =
    procedure.occurrenceDateTime ??
    procedure.occurrencePeriod?.start ??
    procedure.occurrenceTiming?.event?.[0];
  return value ? value.slice(0, 10) : null;
}

/** The service request a procedure log is based on. */
export function getProcedureRequestId(procedure: Procedure): string | null {
  for (const based of procedure.basedOn ?? []) {
    const reference = based.reference;
    if (reference?.startsWith('ServiceRequest/')) return reference.slice(15);
  }
  return null;
}

/** Minutes the procedure took, when recorded. */
export function getProcedureDuration(procedure: Procedure): number | null {
  const repeat = procedure.occurrenceTiming?.repeat;
  const minutes = toMinutes(repeat?.duration, repeat?.durationUnit);
  if (minutes !== undefined) return minutes;
  const { start, end } = procedure.occurrencePeriod ?? {};
  if (start?.includes('T') && end?.includes('T')) {
    const elapsed = (Date.parse(end) - Date.parse(start)) / 60000;
    if (Number.isFinite(elapsed) && elapsed >= 0) return Math.round(elapsed);
  }
  return null;
}

export const getProcedureAnswer = (
  procedure: Procedure
): TreatmentLogAnswer | null =>
  procedure.status === 'completed'
    ? 'taken'
    : procedure.status === 'not-done'
      ? 'not-taken'
      : null;

/** The id of the log answering a request on a day. */
export const getProcedureLogId = (requestId: string, date: string) =>
  `${requestId}-${date}`;

/** A scheduled service request to answer on a day. */
export interface ProcedureItem {
  /** Id of the Procedure that records the answer. */
  key: string;
  /** Stable within the day: the request id. */
  rowId: string;
  request: ServiceRequest;
  answer: TreatmentLogAnswer | null;
  log?: Procedure;
  /** Minutes recorded for a done answer. */
  duration: number | null;
  /** Minutes planned each time. */
  plannedDuration?: number;
  /** Which session this is, and of how many, when the count is limited. */
  session?: { number: number; count: number };
  /** The window it is due in after the last session, when it repeats. */
  due?: { from: string; to?: string };
}

/**
 * The scheduled requests to answer on a day. A request is due from its start
 * while sessions remain (`count`), once its period has passed since the last
 * completed session; an answer given that day keeps it listed. "Not done"
 * answers are not sessions.
 */
export function buildProcedureItems(
  date: string,
  requests: ServiceRequest[],
  procedures: Procedure[]
): ProcedureItem[] {
  const items: ProcedureItem[] = [];
  for (const request of requests) {
    const id = request.id;
    const schedule = getRequestSchedule(request);
    if (!id || !schedule) continue;
    const logs = procedures.filter(
      (procedure) => getProcedureRequestId(procedure) === id
    );
    const log =
      logs.find((procedure) => procedure.id === getProcedureLogId(id, date)) ??
      logs.find(
        (procedure) =>
          getProcedureDate(procedure) === date &&
          Boolean(getProcedureAnswer(procedure))
      );
    const sessions = logs
      .filter((procedure) => procedure.status === 'completed')
      .map(getProcedureDate)
      .filter((day): day is string => Boolean(day) && day! < date)
      .sort();
    const last = sessions[sessions.length - 1];
    const next = last && addPeriod(last, schedule.period, schedule.unit);
    const isDue =
      DUE_STATUSES.includes(request.status) &&
      date >= schedule.start &&
      (!schedule.count || sessions.length < schedule.count) &&
      (!next || date >= next);
    if (!isDue && !log) continue;
    // A daily schedule has no window worth showing.
    const showsWindow =
      next && !(schedule.unit === 'd' && schedule.period === 1);
    items.push({
      key: log?.id ?? getProcedureLogId(id, date),
      rowId: id,
      request,
      answer: log ? getProcedureAnswer(log) : null,
      log,
      duration: log ? getProcedureDuration(log) : null,
      ...(schedule.duration !== undefined && {
        plannedDuration: schedule.duration,
      }),
      ...(schedule.count && {
        session: {
          number: Math.min(sessions.length + 1, schedule.count),
          count: schedule.count,
        },
      }),
      ...(showsWindow && {
        due: {
          from: next,
          ...(schedule.periodMax && {
            to: addPeriod(last, schedule.periodMax, schedule.unit),
          }),
        },
      }),
    });
  }
  return items;
}
