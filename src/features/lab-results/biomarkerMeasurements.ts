import type { Observation } from 'fhir/r5';
import {
  CBC_MARKERS,
  type CBCBiomarkerDefinition,
} from '@/src/data/cbcMarkers';

export type MeasurementStatus = 'Low' | 'Normal' | 'High';
export type MeasurementReferenceRange = { low?: number; high?: number };

export function getObservationMarker(observation: Observation) {
  const coding = observation.code.coding?.[0];
  const name = (coding?.display || observation.code.text || '').toLowerCase();
  return CBC_MARKERS.find(
    (marker) =>
      marker.loinc === coding?.code ||
      marker.name.toLowerCase() === name ||
      marker.aliases.some((alias) => alias.toLowerCase() === name)
  );
}

export function getObservationUnitCode(observation: Observation) {
  return (
    observation.valueQuantity?.code || observation.valueQuantity?.unit || ''
  );
}

export function convertBiomarkerValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  marker?: CBCBiomarkerDefinition
) {
  if (!Number.isFinite(value)) return undefined;
  if (fromUnit === toUnit) return value;
  const from = marker?.units.find(
    (unit) => unit.ucum === fromUnit || unit.label === fromUnit
  );
  const to = marker?.units.find(
    (unit) => unit.ucum === toUnit || unit.label === toUnit
  );
  if (!from || !to) return undefined;
  return (value / (from.factor ?? 1)) * (to.factor ?? 1);
}

/** Returns the reference bounds in the observation's reported unit. */
export function getObservationReferenceRange(
  observation: Observation,
  marker = getObservationMarker(observation)
): MeasurementReferenceRange | undefined {
  const unitCode = getObservationUnitCode(observation);
  const reportedRange = observation.referenceRange?.find(
    (range) => range.low?.value !== undefined || range.high?.value !== undefined
  );
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
  const low = reportedRange
    ? convertBound(reportedRange.low)
    : marker?.referenceRange?.low === undefined
      ? undefined
      : convertBiomarkerValue(
          marker.referenceRange.low,
          marker.ucumCode,
          unitCode,
          marker
        );
  const high = reportedRange
    ? convertBound(reportedRange.high)
    : marker?.referenceRange?.high === undefined
      ? undefined
      : convertBiomarkerValue(
          marker.referenceRange.high,
          marker.ucumCode,
          unitCode,
          marker
        );
  if (low === undefined && high === undefined) return undefined;
  if (low !== undefined && high !== undefined && high <= low) return undefined;
  return { low, high };
}

export function getObservationStatus(
  observation: Observation,
  marker = getObservationMarker(observation)
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
  const range = getObservationReferenceRange(observation, marker);
  if (value === undefined || !Number.isFinite(value) || !range)
    return undefined;
  if (range.low !== undefined && value < range.low) return 'Low';
  if (range.high !== undefined && value > range.high) return 'High';
  return 'Normal';
}
