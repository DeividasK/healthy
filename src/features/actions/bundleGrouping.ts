import type { RequestOrchestration } from 'fhir/r5';
import {
  getBundleMemberIds,
  getBundleSlots,
  getSlotTime,
  type BundleTime,
} from '@/src/features/bundles/bundleModel';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';

/** Clock time (HH:mm) of each part of the day, from the profile's settings. */
export type TimesOfDay = Partial<Record<string, string>>;

/** One time of a bundle on a day, with the doses it groups. */
export interface BundleRow {
  kind: 'bundle';
  /** Stable within the day: the bundle id and the slot's index. */
  key: string;
  bundle: RequestOrchestration;
  time: BundleTime | null;
  items: ActionItem[];
}

export type JournalRow = { kind: 'item'; item: ActionItem } | BundleRow;

const minutesOf = (time?: string) => {
  const match = time && /^(\d{2}):(\d{2})/.exec(time);
  return match ? +match[1] * 60 + +match[2] : null;
};

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
 * Groups a day's items into its bundles' times. Earlier bundles claim doses
 * first and a dose joins at most one time. For each treatment in a bundle:
 *
 * - a bundle without a time takes all of its doses;
 * - a dose at the same clock time as one of the bundle's times joins it
 *   (parts of the day count as their clock time from the settings);
 * - doses without a time fill the bundle's remaining times in order;
 * - a treatment with a single dose that day always joins, at the nearest time.
 *
 * Answers that no longer match the day's regimen are never grouped, so a
 * bundle's buttons only answer doses due under it. Bundle times come first,
 * in clock order (without a time last), then the other items as they were.
 */
export function groupActionDay(
  items: ActionItem[],
  bundles: RequestOrchestration[],
  timesOfDay: TimesOfDay
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
        },
        minutes: getTimeMinutes(time, timesOfDay),
      };
    });
    if (!slots.length) return;
    for (const memberId of getBundleMemberIds(bundle)) {
      const doses = items.filter(
        (item) =>
          item.treatment.id === memberId &&
          !item.mismatch &&
          !claimed.has(item.key)
      );
      if (!doses.length) continue;
      const join = (slot: (typeof slots)[number], item: ActionItem) => {
        slot.row.items.push(item);
        claimed.add(item.key);
      };
      if (slots.length === 1 && slots[0].minutes === null) {
        doses.forEach((item) => join(slots[0], item));
        continue;
      }
      const filled = new Set<number>();
      const untimed: ActionItem[] = [];
      const unmatched: ActionItem[] = [];
      for (const item of doses) {
        const minutes = getItemMinutes(item, timesOfDay);
        const index =
          minutes === null
            ? -1
            : slots.findIndex((slot) => slot.minutes === minutes);
        if (index >= 0) {
          join(slots[index], item);
          filled.add(index);
        } else (minutes === null ? untimed : unmatched).push(item);
      }
      for (const item of untimed) {
        let index = slots.findIndex((_, candidate) => !filled.has(candidate));
        if (index < 0 && slots.length === 1) index = 0;
        if (index < 0) continue;
        join(slots[index], item);
        filled.add(index);
      }
      if (doses.length === 1 && unmatched.length === 1) {
        const minutes = getItemMinutes(unmatched[0], timesOfDay)!;
        const distance = (slot: (typeof slots)[number]) =>
          slot.minutes === null ? Infinity : Math.abs(slot.minutes - minutes);
        const nearest = slots.reduce((best, slot) =>
          distance(slot) < distance(best) ? slot : best
        );
        join(nearest, unmatched[0]);
      }
    }
    for (const { row, minutes } of slots)
      if (row.items.length) rows.push({ ...row, minutes, order: bundleIndex });
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
  ];
}

/** The bundle's answer when all its doses share one, else null. */
export function getBundleAnswer(
  items: ActionItem[]
): TreatmentLogAnswer | null {
  const [first] = items;
  return first?.answer && items.every((item) => item.answer === first.answer)
    ? first.answer
    : null;
}

/**
 * Answers every dose in a bundle; pressing the bundle's selected answer again
 * clears them all.
 */
export function getBundleChanges(
  items: ActionItem[],
  pressed: TreatmentLogAnswer
): { item: ActionItem; answer: TreatmentLogAnswer | null }[] {
  const answer = getBundleAnswer(items) === pressed ? null : pressed;
  return items
    .filter((item) => item.answer !== answer)
    .map((item) => ({ item, answer }));
}
