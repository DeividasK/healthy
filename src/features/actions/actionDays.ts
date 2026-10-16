import type { MedicationAdministration, MedicationRequest } from 'fhir/r5';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';

/** How many days the homepage and the actions view show at once. */
export const ACTION_WINDOW_DAYS = 7;

export type TreatmentLogAnswer = 'taken' | 'not-taken';

/** One day of actions: the treatments to answer and the answers given. */
export interface ActionDay {
  date: string;
  treatments: MedicationRequest[];
  /** Answers by treatment id. */
  answers: Record<string, TreatmentLogAnswer>;
  /** The stored logs by treatment id. */
  logs: Record<string, MedicationAdministration>;
}

/** The local day (YYYY-MM-DD) a treatment log is recorded for. */
export function getAdministrationDate(
  administration: MedicationAdministration
): string | null {
  const value =
    administration.occurenceDateTime ?? administration.occurencePeriod?.start;
  return value ? value.slice(0, 10) : null;
}

/** The treatment (MedicationRequest) id a log is based on. */
export function getAdministrationRequestId(
  administration: MedicationAdministration
): string | null {
  const reference = administration.request?.reference;
  return reference?.startsWith('MedicationRequest/')
    ? reference.slice(18)
    : null;
}

export const todayKey = (now = new Date()) => formatLocalDate(now);

/** The local day `delta` days after `date` (YYYY-MM-DD). */
export function addDays(date: string, delta: number): string {
  const day = parseLocalDate(date);
  day.setDate(day.getDate() + delta);
  return formatLocalDate(day);
}

/** `count` consecutive days ending on `end`, oldest first. */
export function daysEndingOn(
  end: string,
  count = ACTION_WINDOW_DAYS
): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(end, index - count + 1)
  );
}

/**
 * The days the actions view shows: the week ending today, or ending on the
 * selected day once it is older than that.
 */
export function getDayWindow(selected: string, today: string): string[] {
  const oldestOfWeek = addDays(today, 1 - ACTION_WINDOW_DAYS);
  return daysEndingOn(selected < oldestOfWeek ? selected : today);
}

export const getAnswer = (
  administration: MedicationAdministration
): TreatmentLogAnswer | null =>
  administration.status === 'completed'
    ? 'taken'
    : administration.status === 'not-done'
      ? 'not-taken'
      : null;

/**
 * Treatments to answer on a day: active treatments started on or before it,
 * plus any treatment already answered that day, so logged history stays
 * visible after a treatment ends.
 */
export function buildActionDay(
  date: string,
  treatments: MedicationRequest[],
  administrations: MedicationAdministration[]
): ActionDay {
  const logs: Record<string, MedicationAdministration> = {};
  const answers: Record<string, TreatmentLogAnswer> = {};
  for (const administration of administrations) {
    if (getAdministrationDate(administration) !== date) continue;
    const requestId = getAdministrationRequestId(administration);
    const answer = getAnswer(administration);
    if (!requestId || !answer) continue;
    logs[requestId] = administration;
    answers[requestId] = answer;
  }
  return {
    date,
    treatments: treatments.filter(
      (treatment) =>
        Boolean(treatment.id && answers[treatment.id]) ||
        (treatment.status === 'active' &&
          (!treatment.authoredOn || treatment.authoredOn.slice(0, 10) <= date))
    ),
    answers,
    logs,
  };
}

/** A day is complete once every treatment listed for it is answered. */
export const isDayComplete = (day: ActionDay) =>
  day.treatments.length > 0 &&
  day.treatments.every((treatment) => Boolean(day.answers[treatment.id || '']));

const formatDay = (date: string, options: Intl.DateTimeFormatOptions) =>
  parseLocalDate(date).toLocaleDateString('en-US', options);

/** Short weekday, e.g. "Sat". */
export const formatWeekday = (date: string) =>
  formatDay(date, { weekday: 'short' });

/** Day of the month, e.g. "16". */
export const formatDayOfMonth = (date: string) => String(Number(date.slice(8)));

/** Label between the day arrows: "Today", "Yesterday" or "Thu, Oct 15". */
export function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  return formatDay(date, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Full date for accessibility labels, e.g. "Friday, October 16". */
export const formatLongDate = (date: string) =>
  formatDay(date, { weekday: 'long', month: 'long', day: 'numeric' });

/** The question above the day's treatments. */
export function formatActionsHeading(date: string, today: string): string {
  return date === today
    ? `What's happening today, ${formatDay(date, { month: 'long', day: 'numeric' })}?`
    : `What happened on ${formatLongDate(date)}?`;
}
