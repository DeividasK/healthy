import type { Observation } from 'fhir/r5';
import { BIOMARKERS } from '@/src/data/biomarkers';
import type { DiagnosticReportRecord } from '@/src/database/types';
import {
  convertBiomarkerValue,
  getObservationMarker,
  getObservationUnitCode,
  isSupportedObservation,
} from './biomarkerMeasurements';

const CALCULATED_BIOMARKERS = BIOMARKERS.filter((marker) => marker.calculation);

/**
 * Observations the app works out from a report's results, such as the
 * atherogenic index from triglycerides and HDL. They are never stored: each
 * is derived from its inputs, which `derivedFrom` references, whenever
 * results are shown. Values are rounded to two decimals.
 */
export function getCalculatedObservations({
  report,
  observations,
}: DiagnosticReportRecord): Observation[] {
  const byMarker = new Map<string, Observation>();
  for (const observation of observations) {
    if (!isSupportedObservation(observation)) continue;
    const id = getObservationMarker(observation)!.id;
    if (!byMarker.has(id)) byMarker.set(id, observation);
  }
  return CALCULATED_BIOMARKERS.flatMap((marker): Observation[] => {
    const { inputs, calculate } = marker.calculation!;
    const sources = inputs.flatMap(({ id }) => byMarker.get(id) ?? []);
    if (sources.length < inputs.length) return [];
    const values = sources.map((source, index) => {
      const value = source.valueQuantity?.value;
      return value === undefined
        ? undefined
        : convertBiomarkerValue(
            value,
            getObservationUnitCode(source),
            inputs[index].unit,
            getObservationMarker(source)
          );
    });
    if (values.some((value) => value === undefined)) return [];
    const value = calculate(values as number[]);
    if (!Number.isFinite(value)) return [];
    const [unit] = marker.units;
    return [
      {
        resourceType: 'Observation',
        id: `${report.id}-${marker.id}`,
        status: 'final',
        category: sources[0].category,
        code: { text: marker.name },
        subject: sources[0].subject,
        effectiveDateTime:
          sources[0].effectiveDateTime ?? report.effectiveDateTime,
        valueQuantity: {
          value: Number(value.toFixed(2)),
          unit: unit.label,
          system: 'http://unitsofmeasure.org',
          code: unit.ucum,
        },
        derivedFrom: sources.map((source) => ({
          reference: `Observation/${source.id}`,
        })),
      },
    ];
  });
}

/** Adds each report's calculated observations after its recorded ones. */
export function withCalculatedObservations(
  records: DiagnosticReportRecord[]
): DiagnosticReportRecord[] {
  return records.map((record) => {
    const calculated = getCalculatedObservations(record);
    return calculated.length
      ? { ...record, observations: [...record.observations, ...calculated] }
      : record;
  });
}
