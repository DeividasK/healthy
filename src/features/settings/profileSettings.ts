import {
  isWrittenLimit,
  type BiomarkerRangeEntry,
} from '@/src/features/lab-results/biomarkerRanges';
import { getWhenLabel } from '@/src/features/treatments/regimen';

/** A part of the day offered in forms (FHIR `Timing.repeat.when`). */
export type PartOfDay = 'MORN' | 'NOON' | 'AFT' | 'EVE' | 'HS';

/**
 * The journal's order within each part of the day (or `any`, or a clock time
 * HH:mm before the first part): resource keys (`MedicationRequest/<id>`,
 * `ServiceRequest/<id>`, `RequestOrchestration/<id>`), first on top.
 */
export type JournalOrder = Partial<
  Record<PartOfDay | 'any' | `${string}:${string}`, string[]>
>;

/**
 * A profile's settings. App infrastructure, not a FHIR resource: synced as
 * `ProfileSettings` with the profile's records.
 */
export interface ProfileSettings {
  /** The clock time (HH:mm) each part of the day stands for. */
  timesOfDay: Record<PartOfDay, string>;
  /** The order the user gave the journal's rows. */
  journalOrder?: JournalOrder;
  /**
   * The unit (UCUM code) each biomarker's page was last shown in, by catalog
   * biomarker id. Kept quietly, not shown in Settings.
   */
  biomarkerUnits?: Record<string, string>;
  /**
   * Ranges the user set on biomarker pages, by biomarker key (as in its
   * page's route), each with the day it took effect. Ranges printed on lab
   * reports live on the results.
   */
  biomarkerRanges?: Record<string, BiomarkerRangeEntry[]>;
}

export const DEFAULT_TIMES_OF_DAY: Record<PartOfDay, string> = {
  MORN: '08:00',
  NOON: '12:00',
  AFT: '15:00',
  EVE: '18:00',
  HS: '22:00',
};

export const PARTS_OF_DAY = (
  Object.keys(DEFAULT_TIMES_OF_DAY) as PartOfDay[]
).map((code) => ({ code, label: getWhenLabel(code) }));

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A range the user set, with numbers as limits and at least one bound. */
function isUserRange(entry: unknown): entry is BiomarkerRangeEntry {
  if (!entry || typeof entry !== 'object') return false;
  const range = entry as Partial<BiomarkerRangeEntry>;
  const limits = [range.low, range.high, range.optimalLow, range.optimalHigh];
  return (
    range.source === 'user' &&
    typeof range.unit === 'string' &&
    typeof range.since === 'string' &&
    ISO_DATE.test(range.since) &&
    (range.low !== undefined || range.high !== undefined) &&
    limits.every(
      (limit) =>
        limit === undefined ||
        (typeof limit === 'string' && isWrittenLimit(limit))
    )
  );
}

/** Stored settings, with defaults for anything missing or invalid. */
export function withDefaults(stored?: Partial<ProfileSettings> | null) {
  const timesOfDay = { ...DEFAULT_TIMES_OF_DAY };
  for (const { code } of PARTS_OF_DAY) {
    const time = stored?.timesOfDay?.[code];
    if (typeof time === 'string' && CLOCK_TIME.test(time))
      timesOfDay[code] = time;
  }
  // Groups this version does not know are kept for newer devices.
  const storedOrder = stored?.journalOrder;
  const journalOrder: JournalOrder =
    storedOrder &&
    typeof storedOrder === 'object' &&
    !Array.isArray(storedOrder)
      ? { ...storedOrder }
      : {};
  for (const code of Object.keys(journalOrder) as (keyof JournalOrder)[]) {
    const keys = journalOrder[code];
    if (Array.isArray(keys))
      journalOrder[code] = keys.filter((key) => typeof key === 'string');
    else delete journalOrder[code];
  }
  const biomarkerUnits: Record<string, string> = {};
  const storedUnits = stored?.biomarkerUnits;
  if (storedUnits && typeof storedUnits === 'object')
    for (const [marker, unit] of Object.entries(storedUnits))
      if (typeof unit === 'string') biomarkerUnits[marker] = unit;
  const biomarkerRanges: Record<string, BiomarkerRangeEntry[]> = {};
  const storedRanges = stored?.biomarkerRanges;
  if (storedRanges && typeof storedRanges === 'object')
    for (const [marker, entries] of Object.entries(storedRanges))
      if (Array.isArray(entries))
        biomarkerRanges[marker] = entries.filter(isUserRange);
  return {
    ...stored,
    timesOfDay,
    journalOrder,
    biomarkerUnits,
    biomarkerRanges,
  } as ProfileSettings;
}

export const getProfileSettingsId = (patientId: string) =>
  `settings-${patientId}`;
