import type { Observation } from 'fhir/r5';
import {
  getBiomarkerKey,
  type BiomarkerDefinition,
} from '@/src/data/biomarkers';
import type { DiagnosticReportRecord } from '@/src/database/types';
import {
  convertBiomarkerValue,
  getObservationMarker,
  getObservationUnitCode,
  isSupportedObservation,
  roundConvertedValue,
  type MeasurementStatus,
} from './biomarkerMeasurements';

/**
 * A biomarker's range as the user gave it: printed on a lab report they
 * added, or typed in on the biomarker page. Limits are in `unit`, kept as
 * written so they show with the decimals they were given (4.0 stays 4.0).
 */
export interface BiomarkerRangeEntry {
  low?: string;
  high?: string;
  optimalLow?: string;
  optimalHigh?: string;
  /** UCUM code of the unit the limits are in. */
  unit: string;
  /** The day the range took effect, as an ISO date. */
  since: string;
  source: 'report' | 'user';
  /** The lab report a reported range was printed on. */
  reportId?: string;
}

/** Each biomarker's range history, oldest first, by biomarker key. */
export type BiomarkerRanges = Record<string, BiomarkerRangeEntry[]>;

const LIMIT_KEYS = ['low', 'high', 'optimalLow', 'optimalHigh'] as const;

export const hasLimits = ({
  low,
  high,
}: Pick<BiomarkerRangeEntry, 'low' | 'high'>) =>
  low !== undefined || high !== undefined;

export const hasOptimal = ({
  optimalLow,
  optimalHigh,
}: Pick<BiomarkerRangeEntry, 'optimalLow' | 'optimalHigh'>) =>
  optimalLow !== undefined || optimalHigh !== undefined;

/** "3.5–5.1", "below 30" or "above 60". */
export function formatLimits(low?: string, high?: string) {
  if (low !== undefined && high !== undefined) return `${low}–${high}`;
  if (high !== undefined) return `below ${high}`;
  if (low !== undefined) return `above ${low}`;
  return '';
}

/** Whether text is a limit as the app stores it: a number like 3.5 or -2. */
export const isWrittenLimit = (text: string) => /^-?\d+(\.\d+)?$/.test(text);

/** A limit's value, for comparing and placing results. */
export const limitValue = (limit?: string) =>
  limit === undefined ? undefined : Number(limit);

/**
 * The range with its limits in `unit`. Limits already in it keep the
 * decimals they were written with; converted ones are rounded the way
 * laboratories print converted ranges. Undefined when a limit can't convert.
 */
export function rangeInUnit(
  entry: BiomarkerRangeEntry,
  unit: string,
  marker?: BiomarkerDefinition
): BiomarkerRangeEntry | undefined {
  if (entry.unit === unit) return entry;
  const converted: BiomarkerRangeEntry = { ...entry, unit };
  for (const key of LIMIT_KEYS) {
    const limit = entry[key];
    if (limit === undefined) continue;
    const value = Number(limit);
    const inUnit = convertBiomarkerValue(value, entry.unit, unit, marker);
    if (inUnit === undefined) return undefined;
    converted[key] = String(roundConvertedValue(inUnit, value));
  }
  return converted;
}

/** Whether two ranges have the same limits, however they are written. */
function sameRange(
  a: BiomarkerRangeEntry,
  b: BiomarkerRangeEntry,
  marker?: BiomarkerDefinition
) {
  const other = rangeInUnit(b, a.unit, marker);
  return (
    other !== undefined &&
    LIMIT_KEYS.every((key) => limitValue(a[key]) === limitValue(other[key]))
  );
}

/**
 * The range's history, oldest first: an entry only where the range changed,
 * so a report repeating the same range adds nothing. Once the user sets a
 * range, reports from that day on no longer change it.
 */
export function rangeHistory(
  entries: BiomarkerRangeEntry[],
  marker?: BiomarkerDefinition
) {
  const firstUserSet = entries
    .filter(({ source }) => source === 'user')
    .map(({ since }) => since)
    .sort()[0];
  return entries
    .filter(
      ({ source, since }) =>
        source === 'user' || firstUserSet === undefined || since < firstUserSet
    )
    .sort((a, b) => a.since.localeCompare(b.since))
    .filter(
      (entry, index, sorted) =>
        index === 0 || !sameRange(entry, sorted[index - 1], marker)
    );
}

/** The range in effect on a day: the latest one by then, else the first. */
export function rangeOn(history: BiomarkerRangeEntry[], date: string) {
  return (
    history.findLast(({ since }) => since <= date.slice(0, 10)) ?? history[0]
  );
}

/**
 * The limits of a range written by `formatLimits`, or undefined when the
 * text isn't one.
 */
export function parseLimits(
  text: string
): Pick<BiomarkerRangeEntry, 'low' | 'high'> | undefined {
  const limit = '(-?\\d+(?:\\.\\d+)?)';
  const both = text.match(new RegExp(`^${limit}–${limit}$`));
  if (both) return { low: both[1], high: both[2] };
  const high = text.match(new RegExp(`^below ${limit}$`));
  if (high) return { high: high[1] };
  const low = text.match(new RegExp(`^above ${limit}$`));
  if (low) return { low: low[1] };
  return undefined;
}

/** The range printed with a result, as a range entry. */
export function reportedRangeEntry(
  observation: Observation,
  since: string,
  reportId?: string
): BiomarkerRangeEntry | undefined {
  const range = observation.referenceRange?.find(
    ({ low, high }) => low?.value !== undefined || high?.value !== undefined
  );
  if (!range) return undefined;
  const bound = range.low?.value !== undefined ? range.low : range.high;
  // The text keeps the limits as written (5.0, not 5), when it matches them.
  const written = range.text ? parseLimits(range.text) : undefined;
  const asWritten = (value: number | undefined, text: string | undefined) =>
    text !== undefined && Number(text) === value ? text : String(value);
  return {
    ...(range.low?.value !== undefined && {
      low: asWritten(range.low.value, written?.low),
    }),
    ...(range.high?.value !== undefined && {
      high: asWritten(range.high.value, written?.high),
    }),
    unit: bound?.code || bound?.unit || getObservationUnitCode(observation),
    since: since.slice(0, 10),
    source: 'report',
    ...(reportId && { reportId }),
  };
}

/**
 * Every biomarker's range history: the ranges printed on the lab reports and
 * the ones the user set (`userRanges`, from the profile's settings).
 */
export function buildBiomarkerRanges(
  records: DiagnosticReportRecord[],
  userRanges: BiomarkerRanges = {}
): BiomarkerRanges {
  const entries: BiomarkerRanges = {};
  const markers: Record<string, BiomarkerDefinition> = {};
  for (const { report, observations } of records) {
    for (const observation of observations) {
      if (!isSupportedObservation(observation)) continue;
      const marker = getObservationMarker(observation)!;
      const entry = reportedRangeEntry(
        observation,
        observation.effectiveDateTime || report.effectiveDateTime || '',
        report.id
      );
      if (!entry) continue;
      const key = getBiomarkerKey(marker);
      markers[key] = marker;
      (entries[key] ??= []).push(entry);
    }
  }
  for (const [key, set] of Object.entries(userRanges))
    entries[key] = [...(entries[key] ?? []), ...set];
  return Object.fromEntries(
    Object.entries(entries).map(([key, list]) => [
      key,
      rangeHistory(list, markers[key]),
    ])
  );
}

/** A range's limits as numbers, for placing results. */
export interface ResolvedRange {
  low?: number;
  high?: number;
  optimalLow?: number;
  optimalHigh?: number;
}

/**
 * The range in effect for a result, in the result's unit or `targetUnit`:
 * from the biomarker's history in `ranges`, or without one the range printed
 * with the result.
 */
export function getObservationRange(
  observation: Observation,
  ranges?: BiomarkerRanges,
  marker = getObservationMarker(observation),
  targetUnit = getObservationUnitCode(observation)
): ResolvedRange | undefined {
  const date = observation.effectiveDateTime || '';
  const history = marker ? ranges?.[getBiomarkerKey(marker)] : undefined;
  const entry = history?.length
    ? rangeOn(history, date)
    : reportedRangeEntry(observation, date);
  const inUnit = entry && rangeInUnit(entry, targetUnit, marker);
  if (!inUnit || !hasLimits(inUnit)) return undefined;
  const low = limitValue(inUnit.low);
  const high = limitValue(inUnit.high);
  if (low !== undefined && high !== undefined && high <= low) return undefined;
  return {
    low,
    high,
    optimalLow: limitValue(inUnit.optimalLow),
    optimalHigh: limitValue(inUnit.optimalHigh),
  };
}

/**
 * A result's status against the range in effect for it. Without a range,
 * the laboratory's own low, normal or high flag, if it gave one.
 */
export function getObservationStatus(
  observation: Observation,
  ranges?: BiomarkerRanges,
  marker = getObservationMarker(observation)
): MeasurementStatus | undefined {
  const value = observation.valueQuantity?.value;
  const range = getObservationRange(observation, ranges, marker);
  if (range && value !== undefined && Number.isFinite(value)) {
    if (range.low !== undefined && value < range.low) return 'Low';
    if (range.high !== undefined && value > range.high) return 'High';
    return 'Normal';
  }
  const code = observation.interpretation
    ?.flatMap(({ coding }) => coding?.map((coding) => coding.code) ?? [])
    .find((candidate) => ['L', 'LL', 'N', 'H', 'HH'].includes(candidate ?? ''));
  if (code === 'L' || code === 'LL') return 'Low';
  if (code === 'H' || code === 'HH') return 'High';
  if (code === 'N') return 'Normal';
  return undefined;
}
