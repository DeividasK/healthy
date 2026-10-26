import type { RequestOrchestration } from 'fhir/r5';
import {
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleSlots,
  getSlotTime,
  type BundleTime,
} from '@/src/features/bundles/bundleModel';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';
import type { ProcedureItem } from './procedureDays';

/** Clock time (HH:mm) of each part of the day, from the profile's settings. */
export type TimesOfDay = Partial<Record<string, string>>;

/** One time of a bundle on a day, with the doses and activities it groups. */
export interface BundleRow {
  kind: 'bundle';
  /** Stable within the day: the bundle id and the slot's index. */
  key: string;
  bundle: RequestOrchestration;
  time: BundleTime | null;
  items: ActionItem[];
  procedures: ProcedureItem[];
}

export type JournalRow =
  | { kind: 'item'; item: ActionItem }
  | { kind: 'procedure'; item: ProcedureItem }
  | BundleRow;

const minutesOf = (time?: string) => {
  const match = time && /^(\d{2}):(\d{2})/.exec(time);
  return match ? +match[1] * 60 + +match[2] : null;
};

/** A procedure's clock time in minutes, from its request's schedule. */
export function getProcedureMinutes(
  item: ProcedureItem,
  timesOfDay: TimesOfDay
): number | null {
  const repeat = item.request.occurrenceTiming?.repeat;
  if (repeat?.timeOfDay?.length) return minutesOf(repeat.timeOfDay[0]);
  if (repeat?.when?.length) return minutesOf(timesOfDay[repeat.when[0]]);
  return null;
}

/** A dose's clock time in minutes: its exact time, or its part of the day's. */
export function getItemMinutes(
  item: ActionItem,
  timesOfDay: TimesOfDay
): number | null {
  const repeat = item.dose?.dosage?.timing?.repeat;
  if (repeat?.timeOfDay?.length) return minutesOf(repeat.timeOfDay[0]);
  if (repeat?.when?.length) return minutesOf(timesOfDay[repeat.when[0]]);
  return null;
}

export function getTimeMinutes(
  time: BundleTime | null,
  timesOfDay: TimesOfDay
): number | null {
  if (!time) return null;
  return minutesOf(time.kind === 'time' ? time.time : timesOfDay[time.code]);
}

/**
 * Groups a day's doses and activities into its bundles' times. Earlier
 * bundles claim them first and each joins at most one time. For each
 * treatment or activity in a bundle:
 *
 * - a bundle without a time takes all of its entries;
 * - an entry at the same clock time as one of the bundle's times joins it
 *   (parts of the day count as their clock time from the settings);
 * - entries without a time fill the bundle's remaining times in order;
 * - a member with a single entry that day always joins, at the nearest time.
 *
 * Answers that no longer match the day's regimen are never grouped, so a
 * bundle's buttons only answer doses due under it. Bundle times come first,
 * in clock order (without a time last), then the other items and activities
 * as they were.
 */
export function groupActionDay(
  items: ActionItem[],
  bundles: RequestOrchestration[],
  timesOfDay: TimesOfDay,
  procedures: ProcedureItem[] = []
): JournalRow[] {
  const claimed = new Set<string>();
  const rows: (BundleRow & { minutes: number | null; order: number })[] = [];
  bundles.forEach((bundle, bundleIndex) => {
    const slots = getBundleSlots(bundle).map((slot, index) => {
      const time = getSlotTime(slot);
      return {
        row: {
          kind: 'bundle' as const,
          key: `${bundle.id}:${index}`,
          bundle,
          time,
          items: [] as ActionItem[],
          procedures: [] as ProcedureItem[],
        },
        minutes: getTimeMinutes(time, timesOfDay),
      };
    });
    if (!slots.length) return;
    type Slot = (typeof slots)[number];
    /** Places one member's entries for the day into the bundle's slots. */
    const place = <T extends { key: string }>(
      entries: T[],
      minutesOf: (entry: T) => number | null,
      join: (slot: Slot, entry: T) => void
    ) => {
      if (!entries.length) return;
      const add = (slot: Slot, entry: T) => {
        join(slot, entry);
        claimed.add(entry.key);
      };
      if (slots.length === 1 && slots[0].minutes === null) {
        entries.forEach((entry) => add(slots[0], entry));
        return;
      }
      const filled = new Set<number>();
      const untimed: T[] = [];
      const unmatched: T[] = [];
      for (const entry of entries) {
        const minutes = minutesOf(entry);
        const index =
          minutes === null
            ? -1
            : slots.findIndex((slot) => slot.minutes === minutes);
        if (index >= 0) {
          add(slots[index], entry);
          filled.add(index);
        } else (minutes === null ? untimed : unmatched).push(entry);
      }
      for (const entry of untimed) {
        let index = slots.findIndex((_, candidate) => !filled.has(candidate));
        if (index < 0 && slots.length === 1) index = 0;
        if (index < 0) continue;
        add(slots[index], entry);
        filled.add(index);
      }
      if (entries.length === 1 && unmatched.length === 1) {
        const minutes = minutesOf(unmatched[0])!;
        const distance = (slot: Slot) =>
          slot.minutes === null ? Infinity : Math.abs(slot.minutes - minutes);
        const nearest = slots.reduce((best, slot) =>
          distance(slot) < distance(best) ? slot : best
        );
        add(nearest, unmatched[0]);
      }
    };
    for (const memberId of getBundleMemberIds(bundle))
      place(
        items.filter(
          (item) =>
            item.treatment.id === memberId &&
            !item.mismatch &&
            !claimed.has(item.key)
        ),
        (item) => getItemMinutes(item, timesOfDay),
        (slot, item) => slot.row.items.push(item)
      );
    for (const requestId of getBundleActivityIds(bundle))
      place(
        procedures.filter(
          (item) => item.request.id === requestId && !claimed.has(item.key)
        ),
        (item) => getProcedureMinutes(item, timesOfDay),
        (slot, item) => slot.row.procedures.push(item)
      );
    for (const { row, minutes } of slots)
      if (row.items.length || row.procedures.length)
        rows.push({ ...row, minutes, order: bundleIndex });
  });
  rows.sort(
    (a, b) =>
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.order - b.order
  );
  return [
    ...rows.map(({ minutes: _minutes, order: _order, ...row }) => row),
    ...items
      .filter((item) => !claimed.has(item.key))
      .map((item) => ({ kind: 'item' as const, item })),
    ...procedures
      .filter((item) => !claimed.has(item.key))
      .map((item) => ({ kind: 'procedure' as const, item })),
  ];
}

/** The bundle's answer when all its doses and activities share one, else null. */
export function getBundleAnswer(
  items: { answer: TreatmentLogAnswer | null }[]
): TreatmentLogAnswer | null {
  const [first] = items;
  return first?.answer && items.every((item) => item.answer === first.answer)
    ? first.answer
    : null;
}

/** Answers to save for a bundle's doses and activities. */
export interface BundleChanges {
  items: { item: ActionItem; answer: TreatmentLogAnswer | null }[];
  procedures: { item: ProcedureItem; answer: TreatmentLogAnswer | null }[];
}

/**
 * Answers every dose and activity in a bundle; pressing the bundle's selected
 * answer again clears them all.
 */
export function getBundleChanges(
  row: Pick<BundleRow, 'items' | 'procedures'>,
  pressed: TreatmentLogAnswer
): BundleChanges {
  const current = getBundleAnswer([...row.items, ...row.procedures]);
  const answer = current === pressed ? null : pressed;
  const changes = <T extends { answer: TreatmentLogAnswer | null }>(
    entries: T[]
  ) =>
    entries
      .filter((item) => item.answer !== answer)
      .map((item) => ({ item, answer }));
  return { items: changes(row.items), procedures: changes(row.procedures) };
}
