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
  for (const code of [
    ...PARTS_OF_DAY.map((part) => part.code),
    'any',
  ] as const) {
    const keys = journalOrder[code];
    if (keys === undefined) continue;
    if (Array.isArray(keys))
      journalOrder[code] = keys.filter((key) => typeof key === 'string');
    else delete journalOrder[code];
  }
  return { ...stored, timesOfDay, journalOrder } as ProfileSettings;
}

export const getProfileSettingsId = (patientId: string) =>
  `settings-${patientId}`;
