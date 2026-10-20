import {
  PARTS_OF_DAY,
  type JournalOrder,
  type PartOfDay,
} from '@/src/features/settings/profileSettings';
import {
  getItemMinutes,
  getTimeMinutes,
  type JournalRow,
  type TimesOfDay,
} from './bundleGrouping';

/** A part of the day, or `any` for rows without one time. */
export type JournalGroupId = PartOfDay | 'any';

/** The journal rows taken at one part of the day. */
export interface JournalGroup {
  id: JournalGroupId;
  label: string;
  rows: JournalRow[];
}

const ANY_TIME_LABEL = 'Any time';

const isPartOfDay = (code: string): code is PartOfDay =>
  PARTS_OF_DAY.some((part) => part.code === code);

const minutesOf = (time?: string) => {
  const match = time && /^(\d{2}):(\d{2})/.exec(time);
  return match ? +match[1] * 60 + +match[2] : null;
};

/** Parts of the day in clock order, from the profile's settings. */
function getOrderedParts(timesOfDay: TimesOfDay) {
  return PARTS_OF_DAY.map((part, index) => ({
    ...part,
    minutes: minutesOf(timesOfDay[part.code]),
    index,
  })).sort(
    (a, b) =>
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity) || a.index - b.index
  );
}

/** The part of the day nearest a clock time; ties go to the earlier part. */
function getNearestPart(
  minutes: number,
  parts: ReturnType<typeof getOrderedParts>
): PartOfDay | null {
  let nearest: PartOfDay | null = null;
  let best = Infinity;
  for (const part of parts) {
    if (part.minutes === null) continue;
    const distance = Math.abs(part.minutes - minutes);
    if (distance < best) {
      best = distance;
      nearest = part.code;
    }
  }
  return nearest;
}

/**
 * The part of the day a row is taken at: its `when` code, or the part
 * nearest its exact time. A dose taken at several parts of the day, at
 * other times (e.g. with meals) or without a time is `any`.
 */
export function getRowGroup(
  row: JournalRow,
  parts: ReturnType<typeof getOrderedParts>
): JournalGroupId {
  const found = new Set<PartOfDay | null>();
  const add = (code?: string, time?: string) => {
    if (code) found.add(isPartOfDay(code) ? code : null);
    const minutes = minutesOf(time);
    if (time)
      found.add(minutes === null ? null : getNearestPart(minutes, parts));
  };
  if (row.kind === 'bundle') {
    if (row.time?.kind === 'when') add(row.time.code);
    else if (row.time) add(undefined, row.time.time);
  } else {
    const repeat = row.item.dose?.dosage?.timing?.repeat;
    for (const code of repeat?.when ?? []) add(code);
    for (const time of repeat?.timeOfDay ?? []) add(undefined, time);
  }
  const [only] = found;
  return found.size === 1 && only ? only : 'any';
}

/** The resource a row orders by: its treatment, or its bundle. */
export const getJournalRowOrderKey = (row: JournalRow) =>
  row.kind === 'bundle'
    ? `RequestOrchestration/${row.bundle.id}`
    : `MedicationRequest/${row.item.treatment.id}`;

const getRowMinutes = (row: JournalRow, timesOfDay: TimesOfDay) =>
  row.kind === 'bundle'
    ? getTimeMinutes(row.time, timesOfDay)
    : getItemMinutes(row.item, timesOfDay);

/**
 * Rows in the user's order: resources in `order` first, as listed, then the
 * others as they come. Rows of one resource stay together.
 */
export function applyJournalOrder(
  rows: JournalRow[],
  order: string[] = []
): JournalRow[] {
  const ranks = new Map<string, number>();
  order.forEach((key, index) => {
    if (!ranks.has(key)) ranks.set(key, index);
  });
  let next = order.length;
  for (const row of rows) {
    const key = getJournalRowOrderKey(row);
    if (!ranks.has(key)) ranks.set(key, next++);
  }
  return rows
    .map((row, index) => ({
      row,
      index,
      rank: ranks.get(getJournalRowOrderKey(row))!,
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ row }) => row);
}

/**
 * A day's rows by part of the day, in clock order with `any` last. Within a
 * part, rows come in the user's order, then by clock time.
 */
export function groupJournalRows(
  rows: JournalRow[],
  timesOfDay: TimesOfDay,
  journalOrder: JournalOrder = {}
): JournalGroup[] {
  const parts = getOrderedParts(timesOfDay);
  const byGroup = new Map<JournalGroupId, JournalRow[]>();
  for (const row of rows) {
    const id = getRowGroup(row, parts);
    byGroup.set(id, [...(byGroup.get(id) ?? []), row]);
  }
  return [
    ...parts.map((part) => ({ id: part.code, label: part.label })),
    { id: 'any' as const, label: ANY_TIME_LABEL },
  ].flatMap(({ id, label }) => {
    const groupRows = byGroup.get(id);
    if (!groupRows) return [];
    const byTime = groupRows
      .map((row, index) => ({
        row,
        index,
        // Rows at any time keep the day's order.
        minutes:
          id === 'any' ? 0 : (getRowMinutes(row, timesOfDay) ?? Infinity),
      }))
      .sort((a, b) => a.minutes - b.minutes || a.index - b.index)
      .map(({ row }) => row);
    return [{ id, label, rows: applyJournalOrder(byTime, journalOrder[id]) }];
  });
}

/**
 * Whether a row can move up (-1) or down (1) within its group: past the
 * neighbouring resource, as rows of one resource move together.
 */
export function canMoveJournalRow(
  rows: JournalRow[],
  index: number,
  delta: -1 | 1
): boolean {
  const keys = [...new Set(rows.map(getJournalRowOrderKey))];
  const position = keys.indexOf(getJournalRowOrderKey(rows[index]));
  return position + delta >= 0 && position + delta < keys.length;
}

/**
 * The group's stored order after moving a row up (-1) or down (1) past the
 * neighbouring resource. Resources not shown that day keep their place.
 */
export function moveJournalRow(
  rows: JournalRow[],
  index: number,
  delta: -1 | 1,
  stored: string[] = []
): string[] {
  const keys = [...new Set(rows.map(getJournalRowOrderKey))];
  const position = keys.indexOf(getJournalRowOrderKey(rows[index]));
  const target = position + delta;
  if (position < 0 || target < 0 || target >= keys.length) return stored;
  [keys[position], keys[target]] = [keys[target], keys[position]];
  // Shown resources take the places they had, in their new order.
  const shown = new Set(keys);
  const queue = [...keys];
  const result = [...new Set(stored)].map((key) =>
    shown.has(key) ? queue.shift()! : key
  );
  return [...result, ...queue];
}
