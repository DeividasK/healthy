import type {
  Dosage,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
} from 'fhir/r5';
import {
  addDays,
  formatLocalDate,
  parseLocalDate,
} from '@/src/utils/dateUtils';
import {
  formatDose,
  getScheduledDoses,
} from '@/src/features/treatments/regimen';
import {
  getFirstTakingDay,
  getUsagePeriods,
  isTakingOn,
} from './treatmentUsage';

/** How many days the homepage and the actions view show at once. */
export const ACTION_WINDOW_DAYS = 7;

export type TreatmentLogAnswer = 'taken' | 'not-taken';

/**
 * One thing to answer on a day: a treatment with free-text dosing, or one
 * scheduled dose of a structured regimen.
 */
export interface ActionItem {
  /** Id of the MedicationAdministration that records the answer. */
  key: string;
  /** Stable within the day: the treatment id, plus the dose index for doses. */
  rowId: string;
  treatment: MedicationRequest;
  dose?: {
    /** Index in `dosageInstruction`, absent for a dose no longer prescribed. */
    index?: number;
    dosage?: Dosage;
    text: string;
  };
  answer: TreatmentLogAnswer | null;
  log?: MedicationAdministration;
}

/** One day of actions: what to answer and the answers given. */
export interface ActionDay {
  date: string;
  items: ActionItem[];
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

export { addDays };

/** `count` consecutive days ending on `end`, oldest first. */
export function daysEndingOn(
  end: string,
  count = ACTION_WINDOW_DAYS
): string[] {
  return Array.from({ length: count }, (_, index) =>
    addDays(end, index - count + 1)
  );
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86400000
  );
}

/**
 * The last day the actions view shows: 3 days after the selected one, so it
 * sits in the middle of the 7, but never after today.
 */
export function getStripEnd(selected: string, today: string): string {
  const end = addDays(selected, Math.floor(ACTION_WINDOW_DAYS / 2));
  return end > today ? today : end;
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
 * What to answer on a day: each active treatment being taken that day (a
 * "taking" MedicationStatement period covers it),
 * one row per dose scheduled that day for structured regimens. Answers given
 * that day stay listed even after a treatment ends or its regimen changes.
 */
export function buildActionDay(
  date: string,
  treatments: MedicationRequest[],
  administrations: MedicationAdministration[],
  statements: MedicationStatement[] = []
): ActionDay {
  const logs = administrations.filter(
    (administration) =>
      getAdministrationDate(administration) === date &&
      Boolean(getAnswer(administration))
  );
  const items: ActionItem[] = [];
  for (const treatment of treatments) {
    const id = treatment.id;
    if (!id) continue;
    const treatmentLogs = logs.filter(
      (administration) => getAdministrationRequestId(administration) === id
    );
    const unused = new Set(treatmentLogs);
    const take = (key: string, fallback = false) => {
      const log =
        treatmentLogs.find((candidate) => candidate.id === key) ??
        (fallback ? [...unused][0] : undefined);
      if (log) unused.delete(log);
      return log;
    };
    // Due on days it is being taken (MedicationStatement periods), while the
    // prescription is active.
    const periods = getUsagePeriods(statements, id);
    const isDue = treatment.status === 'active' && isTakingOn(periods, date);
    if (isDue) {
      // Regimen phases count from the first day it was taken.
      const doses = getScheduledDoses(
        treatment,
        date,
        getFirstTakingDay(periods)
      );
      if (doses === null) {
        const key = getTreatmentLogId(id, date);
        const log = take(key, true);
        items.push({ key, rowId: id, treatment, ...withLog(log) });
      } else {
        for (const { index, dosage } of doses) {
          const key = getTreatmentLogId(id, date, index);
          items.push({
            key,
            rowId: `${id}-${index}`,
            treatment,
            dose: { index, dosage, text: formatDose(dosage) },
            ...withLog(take(key)),
          });
        }
      }
    }
    // Answers no longer matching what is due still show.
    for (const log of unused) {
      items.push({
        key: log.id!,
        rowId: log.id!,
        treatment,
        dose: log.dosage?.text ? { text: log.dosage.text } : undefined,
        ...withLog(log),
      });
    }
  }
  return { date, items };
}

const withLog = (log?: MedicationAdministration) => ({
  answer: log ? getAnswer(log) : null,
  log,
});

/**
 * The id of the log answering a treatment, or one of its doses, on a day.
 * Derived from all three, so answers from several devices meet in one
 * resource.
 */
export const getTreatmentLogId = (
  treatmentId: string,
  date: string,
  doseIndex?: number
) =>
  doseIndex === undefined
    ? `${treatmentId}-${date}`
    : `${treatmentId}-${date}-${doseIndex}`;

/**
 * How far a day is logged: `none` when nothing is due, `empty` before any
 * answer, `partial` while some are missing and `complete` once all are given.
 * `future` days cannot be logged yet.
 */
export type DayStatus = 'none' | 'empty' | 'partial' | 'complete' | 'future';

export function getDayStatus(day?: ActionDay): DayStatus {
  if (!day?.items.length) return 'none';
  const answered = day.items.filter((item) => item.answer).length;
  if (!answered) return 'empty';
  return answered === day.items.length ? 'complete' : 'partial';
}

/** A day is complete once everything listed for it is answered. */
export const isDayComplete = (day: ActionDay) =>
  getDayStatus(day) === 'complete';

/** Day status in words, for the calendar's legend and day buttons. */
export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  complete: 'All logged',
  partial: 'Partly logged',
  empty: 'Not logged',
  none: 'Nothing to log',
  future: 'Upcoming',
};

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

/**
 * Answers the previous day gave to the same treatments and doses. Copying
 * them fills only rows still unanswered.
 */
export function getCopyableAnswers(
  day: ActionDay,
  previousDay?: ActionDay
): { item: ActionItem; answer: TreatmentLogAnswer }[] {
  const previous = new Map(
    (previousDay?.items ?? []).map((item) => [item.rowId, item.answer])
  );
  return day.items.flatMap((item) => {
    const answer = previous.get(item.rowId);
    return answer ? [{ item, answer }] : [];
  });
}

/** The days of a month (YYYY-MM) in Monday-first weeks; null pads the grid. */
export function getMonthGrid(month: string): (string | null)[] {
  const first = `${month}-01`;
  const lead = (parseLocalDate(first).getDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let date = first; date.startsWith(month); date = addDays(date, 1))
    days.push(date);
  while (days.length % 7) days.push(null);
  return days;
}

/** The month `delta` months after `month` (YYYY-MM). */
export function addMonths(month: string, delta: number): string {
  const day = parseLocalDate(`${month}-01`);
  day.setMonth(day.getMonth() + delta);
  return formatLocalDate(day).slice(0, 7);
}

/** e.g. "October 2026". */
export const formatMonth = (month: string) =>
  formatDay(`${month}-01`, { month: 'long', year: 'numeric' });

/** Days the actions strip offers at once; others are picked from a calendar. */
export const STRIP_DAYS = 21;

/** Whether a day is within the strip's default days, which end today. */
export const isRecentDay = (date: string, today: string) =>
  daysBetween(date, today) < STRIP_DAYS;

/**
 * The last day of the strip showing `selected`: today for recent days,
 * otherwise 10 days later (never after today), so an older day picked from
 * the calendar sits in the middle of its own 21 days.
 */
export function getStripAnchor(selected: string, today: string): string {
  if (isRecentDay(selected, today)) return today;
  const end = addDays(selected, Math.floor(STRIP_DAYS / 2));
  return end > today ? today : end;
}

/** Days on each side of the selected one that the journal loads first. */
export const NEARBY_DAYS = 2;

/**
 * The days the journal keeps loaded for `selected`, none after today:
 * `nearby` is the selected day with 2 days each side (the day before is also
 * where copied answers come from), so stepping to them shows at once; `strip`
 * is the rest of the strips showing today and the selection, for their marks.
 */
export function getJournalDays(
  selected: string,
  today: string
): { nearby: string[]; strip: string[] } {
  const nearby = daysEndingOn(
    addDays(selected, NEARBY_DAYS),
    2 * NEARBY_DAYS + 1
  ).filter((date) => date <= today);
  const strip = [
    ...new Set([
      ...daysEndingOn(today, STRIP_DAYS),
      ...daysEndingOn(getStripAnchor(selected, today), STRIP_DAYS),
    ]),
  ].filter((date) => !nearby.includes(date));
  return { nearby, strip };
}

/**
 * One treatment's day in its logging history: `taken` when every dose due
 * was taken, `not-taken` once all are answered and any was not, `missing`
 * while some are unanswered, `upcoming` for days ahead and null when nothing
 * was due.
 */
export type TreatmentDayStatus = 'taken' | 'not-taken' | 'missing' | 'upcoming';

export function getTreatmentDayStatus(
  day: ActionDay | undefined,
  treatmentId: string,
  isFuture: boolean
): TreatmentDayStatus | null {
  if (isFuture) return 'upcoming';
  const items = (day?.items ?? []).filter(
    (item) => item.treatment.id === treatmentId
  );
  if (!items.length) return null;
  if (items.some((item) => !item.answer)) return 'missing';
  return items.every((item) => item.answer === 'taken') ? 'taken' : 'not-taken';
}
