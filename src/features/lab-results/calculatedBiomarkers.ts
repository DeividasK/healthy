import type { Observation } from 'fhir/r5';
import { BIOMARKERS, type BiomarkerDefinition } from '@/src/data/biomarkers';
import type { DiagnosticReportRecord } from '@/src/database/types';
import {
  convertBiomarkerValue,
  getObservationMarker,
  getObservationUnitCode,
  isSupportedObservation,
} from './biomarkerMeasurements';

const CALCULATED_BIOMARKERS = BIOMARKERS.filter((marker) => marker.calculation);

/** Whether the app calculated this observation from other results. */
export function isCalculatedObservation(observation: Observation): boolean {
  return Boolean(observation.derivedFrom?.length);
}

/** Works out one biomarker from a report's results, or undefined without its inputs. */
function calculate(
  marker: BiomarkerDefinition,
  report: DiagnosticReportRecord['report'],
  byMarker: Map<string, Observation>
): Observation | undefined {
  const { inputs, calculate } = marker.calculation!;
  const sources = inputs.flatMap(({ id }) => {
    const ids = typeof id === 'string' ? [id] : id;
    const source = ids
      .map((candidate) => byMarker.get(candidate))
      .find(Boolean);
    return source ? [source] : [];
  });
  if (sources.length < inputs.length) return undefined;
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
  if (values.some((value) => value === undefined)) return undefined;
  const calculated = calculate(values as number[]);
  // Shown in the first input's unit when the biomarker has it (e.g. mmol/L).
  const unit =
    marker.units.find(
      ({ ucum, label }) =>
        ucum === getObservationUnitCode(sources[0]) ||
        label === getObservationUnitCode(sources[0])
    ) ?? marker.units[0];
  const value = convertBiomarkerValue(
    calculated,
    marker.units[0].label,
    unit.label,
    marker
  );
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return {
    resourceType: 'Observation',
    id: `${report.id}-${marker.id}`,
    status: 'final',
    category: sources[0].category,
    code: {
      ...(marker.loinc && {
        coding: [
          {
            system: 'http://loinc.org',
            code: marker.loinc,
            display: marker.name,
          },
        ],
      }),
      text: marker.name,
    },
    subject: sources[0].subject,
    effectiveDateTime: sources[0].effectiveDateTime ?? report.effectiveDateTime,
    valueQuantity: {
      value: Number(value.toFixed(2)),
      unit: unit.label,
      system: 'http://unitsofmeasure.org',
      code: unit.ucum,
    },
    derivedFrom: sources.map((source) => ({
      reference: `Observation/${source.id}`,
    })),
  };
}

/**
 * Observations the app works out from a report's results with standard
 * formulas, such as the atherogenic index from triglycerides and HDL. They
 * are never stored: each is derived from its inputs, which `derivedFrom`
 * references, whenever results are shown. Values are rounded to two
 * decimals.
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
  return CALCULATED_BIOMARKERS.flatMap(
    (marker) => calculate(marker, report, byMarker) ?? []
  );
}

/**
 * Adds each report's calculated observations after its recorded ones. A
 * calculated value replaces the report's recorded value of the same
 * biomarker, so it always agrees with its inputs.
 */
export function withCalculatedObservations(
  records: DiagnosticReportRecord[]
): DiagnosticReportRecord[] {
  return records.map((record) => {
    const calculated = getCalculatedObservations(record);
    if (!calculated.length) return record;
    const replaced = new Set(
      calculated.map((observation) => getObservationMarker(observation)!.id)
    );
    return {
      ...record,
      observations: [
        ...record.observations.filter(
          (observation) =>
            !replaced.has(getObservationMarker(observation)?.id ?? '')
        ),
        ...calculated,
      ],
    };
  });
}
