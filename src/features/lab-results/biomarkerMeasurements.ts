import type { Observation, Quantity } from 'fhir/r5';
import {
  BIOMARKERS,
  hasLoincCode,
  type BiomarkerDefinition,
} from '@/src/data/biomarkers';
import {
  CUSTOM_TEST_SYSTEM,
  customTestBiomarker,
} from '@/src/data/biomarkers/customTests';
import { LOINC_CODE_PATTERN, loincTestBiomarker } from '@/src/data/loinc';

export type MeasurementStatus = 'Low' | 'Normal' | 'High';
export type MeasurementReferenceRange = { low?: number; high?: number };
/** Displayed status: low and high results are both out of range. */
export type RangeStatus = 'outOfRange' | 'inRange';
export const RANGE_STATUSES: RangeStatus[] = ['outOfRange', 'inRange'];
export const RANGE_STATUS_LABELS: Record<RangeStatus, string> = {
  outOfRange: 'Out of range',
  inRange: 'In range',
};

/** Orders out-of-range results first, then in range, then those without a range; keeps order within each. */
export function orderByRangeStatus<T extends { status?: RangeStatus }>(
  items: T[]
): T[] {
  const rank = ({ status }: T) => (status ? RANGE_STATUSES.indexOf(status) : 2);
  return [...items].sort((a, b) => rank(a) - rank(b));
}

/** Collapses a low, normal or high status into the displayed range status. */
export function toRangeStatus(
  status: MeasurementStatus | undefined
): RangeStatus | undefined {
  if (!status) return undefined;
  return status === 'Normal' ? 'inRange' : 'outOfRange';
}

/**
 * Matches an observation to its biomarker catalog definition: by code and
 * name together, then by name, then by code. Name first keeps results the
 * app once saved under another test's code (see migration v21) with their
 * own test. A LOINC test outside the catalog gets a definition from the
 * result itself: its name and its reported unit.
 */
export function getObservationMarker(
  observation: Observation
): BiomarkerDefinition | undefined {
  const coding = observation.code.coding?.[0];
  const name = (coding?.display || observation.code.text || '').toLowerCase();
  const byName = (marker: BiomarkerDefinition) =>
    marker.name.toLowerCase() === name ||
    marker.aliases.some((alias) => alias.toLowerCase() === name);
  const byCode = (marker: BiomarkerDefinition) =>
    hasLoincCode(marker, coding?.code);
  return (
    BIOMARKERS.find((marker) => byCode(marker) && byName(marker)) ??
    BIOMARKERS.find(byName) ??
    BIOMARKERS.find(byCode) ??
    getLoincTestMarker(observation) ??
    getCustomTestMarker(observation)
  );
}

function getCustomTestMarker(observation: Observation) {
  const coding = observation.code.coding?.[0];
  const unit =
    observation.valueQuantity?.unit || observation.valueQuantity?.code;
  if (coding?.system !== CUSTOM_TEST_SYSTEM || !unit) return undefined;
  return customTestBiomarker(
    coding.display || observation.code.text || '',
    unit
  );
}

function getLoincTestMarker(observation: Observation) {
  const coding = observation.code.coding?.[0];
  const quantity = observation.valueQuantity;
  const ucum = quantity?.code || quantity?.unit;
  if (
    coding?.system !== 'http://loinc.org' ||
    !coding.code ||
    !LOINC_CODE_PATTERN.test(coding.code) ||
    !ucum
  )
    return undefined;
  return loincTestBiomarker(
    coding.code,
    coding.display || observation.code.text || coding.code,
    [{ label: quantity?.unit || ucum, ucum }]
  );
}

/** Gets the reported UCUM code, falling back to its unit label. */
export function getObservationUnitCode(observation: Observation) {
  return (
    observation.valueQuantity?.code || observation.valueQuantity?.unit || ''
  );
}

/** Rejects observations outside the biomarker catalog or with unsupported/mismatched units. */
export function assertCatalogObservation(observation: Observation) {
  const marker = getObservationMarker(observation);
  if (!marker) {
    const name =
      observation.code.text ||
      observation.code.coding?.[0]?.display ||
      observation.code.coding?.[0]?.code ||
      'Unknown';
    throw new Error(`Biomarker "${name}" is not in the biomarker catalog.`);
  }
  const quantity = observation.valueQuantity;
  const codeUnit = marker.units.find((unit) => unit.ucum === quantity?.code);
  const labelUnit = marker.units.find(
    (unit) => unit.label === quantity?.unit || unit.ucum === quantity?.unit
  );
  if (
    (quantity?.code && !codeUnit) ||
    (quantity?.unit && !labelUnit) ||
    (!codeUnit && !labelUnit)
  ) {
    const unit =
      quantity?.code && !codeUnit
        ? quantity.code
        : quantity?.unit || '(missing)';
    throw new Error(
      `Unsupported unit "${unit}" for ${marker.name}. Supported units: ${marker.units.map((option) => option.label).join(', ')}.`
    );
  }
  if (codeUnit && labelUnit && codeUnit.ucum !== labelUnit.ucum) {
    throw new Error(`Mismatched unit label and UCUM code for ${marker.name}.`);
  }
}

/** Checks whether an existing result is in the catalog with a supported unit, so it can be displayed. */
export function isSupportedObservation(observation: Observation) {
  try {
    assertCatalogObservation(observation);
    return true;
  } catch {
    return false;
  }
}

/** Converts compatible catalog units; returns undefined for unknown conversions. */
export function convertBiomarkerValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  marker?: BiomarkerDefinition
) {
  if (!Number.isFinite(value)) return undefined;
  if (!marker && fromUnit === toUnit) return value;
  const from = marker?.units.find(
    (unit) => unit.ucum === fromUnit || unit.label === fromUnit
  );
  const to = marker?.units.find(
    (unit) => unit.ucum === toUnit || unit.label === toUnit
  );
  if (!from || !to) return undefined;
  if (fromUnit === toUnit) return value;
  // Rounded to 10 significant digits to drop floating point noise.
  return Number(
    ((value / (from.factor ?? 1)) * (to.factor ?? 1)).toPrecision(10)
  );
}

/** Significant digits of a number as written, ignoring trailing zeros of integers. */
function significantDigits(value: number) {
  const digits = String(Math.abs(value))
    .replace(/e.*$/, '')
    .replace('.', '')
    .replace(/^0+/, '');
  return String(value).includes('.')
    ? digits.length
    : digits.replace(/0+$/, '').length;
}

/**
 * Rounds a value or range bound converted from another unit to the precision
 * it was written with (at least two significant digits), the way laboratories
 * print converted ranges: 1.7–2.2 mg/dL becomes 0.70–0.91 mmol/L, not
 * 0.69938–0.90508.
 */
export function roundConvertedValue(converted: number, source: number) {
  if (converted === source || converted === 0) return converted;
  return Number(converted.toPrecision(Math.max(2, significantDigits(source))));
}

export type ResultComparator = NonNullable<Quantity['comparator']>;

const COMPARATOR_SIGNS: Partial<Record<ResultComparator, string>> = {
  '<': '<',
  '<=': '≤',
  '>=': '≥',
  '>': '>',
};

/**
 * The sign before a result reported only as a bound, e.g. "<" for a
 * result of "< 20" (below what the laboratory can measure); '' otherwise.
 */
export function getValueComparator(observation?: Observation): string {
  const comparator = observation?.valueQuantity?.comparator;
  return (comparator && COMPARATOR_SIGNS[comparator]) || '';
}

/**
 * Reads a value as written in a report: a number, optionally after a
 * bound sign, e.g. "14.2", "< 20.00", "≤3" or ">=5". Accepts a comma as the
 * decimal separator.
 */
export function parseResultValue(
  text: string
): { value: number; comparator?: ResultComparator } | undefined {
  const match = text
    .trim()
    .replace(',', '.')
    .match(/^(<=|>=|<|>|≤|≥)?\s*(\d+(?:\.\d+)?)$/);
  if (!match) return undefined;
  const sign = match[1];
  const comparator = (sign === '≤' ? '<=' : sign === '≥' ? '>=' : sign) as
    ResultComparator | undefined;
  return { value: Number(match[2]), ...(comparator && { comparator }) };
}
