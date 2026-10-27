import type { Observation } from 'fhir/r5';
import { BIOMARKERS, type BiomarkerDefinition } from '@/src/data/biomarkers';
import { LOINC_CODE_PATTERN, loincTestBiomarker } from '@/src/data/loinc';
import {
  resolveReferenceRange,
  type MissingDemographic,
  type RangeDemographics,
} from './referenceRanges';

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
    Boolean(coding?.code) && marker.loinc === coding?.code;
  return (
    BIOMARKERS.find((marker) => byCode(marker) && byName(marker)) ??
    BIOMARKERS.find(byName) ??
    BIOMARKERS.find(byCode) ??
    getLoincTestMarker(observation)
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

/**
 * Returns the reference bounds in the observation's reported unit: the range
 * the laboratory reported, else the catalog's range for the patient's sex
 * and age on the test date.
 */
export function getObservationReferenceRange(
  observation: Observation,
  marker = getObservationMarker(observation),
  demographics?: RangeDemographics
): MeasurementReferenceRange | undefined {
  const unitCode = getObservationUnitCode(observation);
  const reportedRange = observation.referenceRange?.find(
    (range) => range.low?.value !== undefined || range.high?.value !== undefined
  );
  /** Converts an individual FHIR bound into the observation's unit. */
  const convertBound = (
    bound: { value?: number; code?: string; unit?: string } | undefined
  ) =>
    bound?.value === undefined
      ? undefined
      : convertBiomarkerValue(
          bound.value,
          bound.code || bound.unit || unitCode,
          unitCode,
          marker
        );
  const catalog =
    reportedRange || !marker
      ? undefined
      : resolveReferenceRange(
          marker,
          demographics,
          observation.effectiveDateTime
        );
  /** Converts a catalog bound from the marker's primary unit. */
  const convertCatalog = (bound: number | undefined) =>
    bound === undefined || !marker
      ? undefined
      : convertBiomarkerValue(bound, marker.ucumCode, unitCode, marker);
  const low = reportedRange
    ? convertBound(reportedRange.low)
    : convertCatalog(catalog?.low);
  const high = reportedRange
    ? convertBound(reportedRange.high)
    : convertCatalog(catalog?.high);
  if (low === undefined && high === undefined) return undefined;
  if (low !== undefined && high !== undefined && high <= low) return undefined;
  return { low, high };
}

/** Prefers recognized FHIR interpretations, then compares unit-aligned bounds. */
export function getObservationStatus(
  observation: Observation,
  marker = getObservationMarker(observation),
  demographics?: RangeDemographics
): MeasurementStatus | undefined {
  const codes = observation.interpretation?.flatMap(
    (interpretation) =>
      interpretation.coding?.map((coding) => coding.code) || []
  );
  const code = codes?.find((candidate) =>
    ['L', 'LL', 'N', 'H', 'HH'].includes(candidate || '')
  );
  if (code === 'L' || code === 'LL') return 'Low';
  if (code === 'H' || code === 'HH') return 'High';
  if (code === 'N') return 'Normal';
  const value = observation.valueQuantity?.value;
  const range = getObservationReferenceRange(observation, marker, demographics);
  if (value === undefined || !Number.isFinite(value) || !range)
    return undefined;
  if (range.low !== undefined && value < range.low) return 'Low';
  if (range.high !== undefined && value > range.high) return 'High';
  return 'Normal';
}

/**
 * What the profile lacks for the observations' catalog ranges: their gender
 * or date of birth, in that order. Ranges a laboratory reported need neither.
 */
export function getMissingDemographics(
  observations: Observation[],
  demographics: RangeDemographics
): MissingDemographic[] {
  const missing = new Set<MissingDemographic>();
  for (const observation of observations) {
    if (observation.referenceRange?.length) continue;
    const marker = getObservationMarker(observation);
    if (!marker) continue;
    for (const field of resolveReferenceRange(
      marker,
      demographics,
      observation.effectiveDateTime
    ).missing)
      missing.add(field);
  }
  return (['sex', 'age'] as const).filter((field) => missing.has(field));
}
