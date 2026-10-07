import * as Crypto from 'expo-crypto';
import type { DiagnosticReport, Observation } from 'fhir/r5';
import {
  GENERAL_LAB_REPORT_LOINC,
  CBC_PANEL_LOINC,
  CBC_MARKERS,
} from '../../data/cbcMarkers';
import {
  insertDiagnosticReportRecord,
  fetchAllDiagnosticReportRecords,
  deleteDiagnosticReportRecord,
} from './labResultsRepository';
import { DiagnosticReportRecord } from '../../database/types';

export interface DiagnosticReportBundle {
  report: DiagnosticReport;
  observations: Observation[];
}

export interface BiomarkerInputItem {
  id: string; // marker canonical id or loinc
  name: string;
  loinc: string;
  value: number;
  unit: string;
  ucumCode: string;
  referenceLow?: number;
  referenceHigh?: number;
}

export interface CreateReportOptions {
  reportId?: string;
  patientId?: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "09:30"
  notes?: string;
  items: BiomarkerInputItem[];
}

/**
 * Builds a standard FHIR Observation from a user biomarker entry.
 */
export function buildFHIRObservation(
  item: BiomarkerInputItem,
  effectiveDateTime: string,
  patientId: string = 'patient-default'
): Observation {
  const observationId = `obs-${Crypto.randomUUID()}`;

  // Calculate optional interpretation if reference range is available
  let interpretation: Observation['interpretation'] = undefined;

  if (item.referenceLow !== undefined || item.referenceHigh !== undefined) {
    let code = 'N';
    let display = 'Normal';
    if (item.referenceLow !== undefined && item.value < item.referenceLow) {
      code = 'L';
      display = 'Low';
    } else if (
      item.referenceHigh !== undefined &&
      item.value > item.referenceHigh
    ) {
      code = 'H';
      display = 'High';
    }
    interpretation = [
      {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code,
            display,
          },
        ],
      },
    ];
  }

  const observation: Observation = {
    resourceType: 'Observation',
    id: observationId,
    status: 'final',
    category: [
      {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: item.loinc,
          display: item.name,
        },
      ],
      text: item.name,
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Self',
    },
    effectiveDateTime,
    valueQuantity: {
      value: item.value,
      unit: item.unit,
      system: 'http://unitsofmeasure.org',
      code: item.ucumCode,
    },
  };

  if (interpretation) {
    observation.interpretation = interpretation;
  }

  if (item.referenceLow !== undefined || item.referenceHigh !== undefined) {
    observation.referenceRange = [
      {
        low:
          item.referenceLow !== undefined
            ? {
                value: item.referenceLow,
                unit: item.unit,
                system: 'http://unitsofmeasure.org',
                code: item.ucumCode,
              }
            : undefined,
        high:
          item.referenceHigh !== undefined
            ? {
                value: item.referenceHigh,
                unit: item.unit,
                system: 'http://unitsofmeasure.org',
                code: item.ucumCode,
              }
            : undefined,
      },
    ];
  }

  return observation;
}

/**
 * Builds and saves a standard FHIR DiagnosticReport with nested observations.
 */
export async function createAndSaveDiagnosticReport(
  options: CreateReportOptions
): Promise<DiagnosticReportBundle> {
  const reportId = options.reportId || `rep-${Crypto.randomUUID()}`;
  const patientId = options.patientId || 'patient-default';
  const now = new Date().toISOString();

  // Determine effective date/time
  let effectiveDateTime = options.date;
  if (options.time) {
    effectiveDateTime = `${options.date}T${options.time}:00`;
  }

  // Build observations
  const observations: Observation[] = options.items.map((item) =>
    buildFHIRObservation(item, effectiveDateTime, patientId)
  );

  // Check if all markers are CBC markers to provide specialized panel LOINC if applicable,
  // else general laboratory report LOINC 11502-2
  const allAreCbc = options.items.every((it) =>
    CBC_MARKERS.some((cbc) => cbc.loinc === it.loinc)
  );
  const panelCode = allAreCbc ? CBC_PANEL_LOINC : GENERAL_LAB_REPORT_LOINC;
  const panelDisplay = allAreCbc
    ? 'Complete blood count (hemogram) panel - Blood by Automated count'
    : 'Laboratory report';

  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: reportId,
    meta: {
      lastUpdated: now,
    },
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'LAB',
            display: 'Laboratory',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: panelCode,
          display: panelDisplay,
        },
      ],
      text: panelDisplay,
    },
    subject: {
      reference: `Patient/${patientId}`,
      display: 'Self',
    },
    effectiveDateTime,
    issued: now,
    result: observations.map((obs) => ({
      reference: `Observation/${obs.id}`,
      type: 'Observation',
      display: obs.code.coding?.[0]?.display || obs.code.text,
    })),
  };

  if (options.notes && options.notes.trim()) {
    report.note = [
      {
        text: options.notes.trim(),
        time: now,
      },
    ];
  }

  await insertDiagnosticReportRecord(report, observations, patientId);

  return { report, observations };
}

/**
 * Gets all diagnostic reports, optionally filtered by patientId.
 */
export async function getAllReports(
  patientId?: string
): Promise<DiagnosticReportRecord[]> {
  return await fetchAllDiagnosticReportRecords(patientId);
}

/**
 * Deletes a diagnostic report by ID.
 */
export async function deleteReport(reportId: string): Promise<void> {
  await deleteDiagnosticReportRecord(reportId);
}

/**
 * Retrieves a single diagnostic report by ID.
 */
export async function getReportById(
  reportId: string
): Promise<DiagnosticReportRecord | null> {
  const reports = await getAllReports();
  return reports.find((r) => r.report.id === reportId) || null;
}
