import * as Crypto from 'expo-crypto';
import type { DiagnosticReport, Observation } from 'fhir/r5';
import {
  GENERAL_LAB_REPORT_LOINC,
  CBC_PANEL_LOINC,
  CBC_MARKERS,
} from '@/src/data/biomarkers';
import {
  insertDiagnosticReportRecord,
  fetchAllDiagnosticReportRecords,
  fetchDiagnosticReportsByConditionId,
  fetchDiagnosticReportsByServiceRequestId,
  deleteDiagnosticReportRecord,
  updateDiagnosticReportJson,
} from './labResultsRepository';
import { DiagnosticReportRecord } from '@/src/database/types';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { resolveOrganizationReference } from '@/src/features/organizations/organizationService';
import {
  getBasedOnServiceRequestIds,
  isOrganizationReference,
  withBasedOnServiceRequests,
} from '@/src/utils/fhirUtils';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { getLabResultTitle } from './labResultMeta';

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
  /**
   * Service provider (Organization) name, found or created on save. Omit to
   * keep the stored performers; `null` or blank removes the Organization.
   */
  serviceProviderName?: string | null;
  /** ServiceRequests the report is based on; omit to keep the stored ones. */
  serviceRequestIds?: string[];
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

  // Elements the form edits; everything else comes from the stored report.
  const fields: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id: reportId,
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
  const notes = options.notes?.trim();
  const providerName = options.serviceProviderName?.trim();

  const db = await getDb();
  let report!: DiagnosticReport;
  // Read and merge the stored report in the saving transaction, so a sync
  // change applied meanwhile is never overwritten by a stale copy.
  await db.withTransactionAsync(async () => {
    const stored = options.reportId
      ? (await getReportById(options.reportId))?.report
      : undefined;
    const existing = stored ? { ...stored } : undefined;
    // Observations are stored separately; drop any `contained` copy left by
    // older ZIP restores.
    delete existing?.contained;

    report = {
      ...existing,
      ...fields,
      meta: { ...existing?.meta, lastUpdated: now },
    };
    if (notes) report.note = [{ text: notes, time: now }];
    else delete report.note;

    const performers = existing?.performer || [];
    const providerIndex = performers.findIndex(isOrganizationReference);
    const current = performers[providerIndex];
    const keep = options.serviceProviderName === undefined;
    const provider = keep
      ? current
      : !providerName
        ? undefined
        : current?.display === providerName
          ? current
          : await resolveOrganizationReference(providerName, patientId);
    const updated = keep
      ? performers
      : providerIndex >= 0
        ? performers.flatMap((performer, index) =>
            index !== providerIndex ? [performer] : provider ? [provider] : []
          )
        : provider
          ? [provider, ...performers]
          : performers;
    if (updated.length) report.performer = updated;
    else delete report.performer;

    if (options.serviceRequestIds)
      report = withBasedOnServiceRequests(report, options.serviceRequestIds);

    await insertDiagnosticReportRecord(report, observations, patientId, true);
  });
  notifyDatabaseChanged([
    'organizations',
    'diagnostic_reports',
    'observations',
  ]);

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

/** Lab results based on a service request whose reason is the condition. */
export async function getLabResultsByConditionId(
  conditionId: string,
  patientId: string
): Promise<DiagnosticReport[]> {
  return await fetchDiagnosticReportsByConditionId(conditionId, patientId);
}

/** Lab results based on the service request. */
export async function getLabResultsByServiceRequestId(
  requestId: string,
  patientId: string
): Promise<DiagnosticReport[]> {
  return await fetchDiagnosticReportsByServiceRequestId(requestId, patientId);
}

/** The patient's lab results as link options, labelled with their date. */
export async function getLabResultLinkOptions(
  patientId: string
): Promise<{ id: string; label: string }[]> {
  return (await getAllReports(patientId)).flatMap(({ report }) => {
    if (!report.id) return [];
    const date = report.effectiveDateTime || report.effectivePeriod?.start;
    const title = getLabResultTitle(report);
    return [
      {
        id: report.id,
        label: date ? `${title} (${formatDisplayDate(date)})` : title,
      },
    ];
  });
}

/** Records that the lab result is based on the service request, or removes it. */
export async function setLabResultServiceRequestLink(
  reportId: string,
  requestId: string,
  patientId: string,
  linked: boolean
): Promise<void> {
  const db = await getDb();
  let changed = false;
  await db.withTransactionAsync(async () => {
    const stored = await getReportById(reportId);
    if (!stored || stored.report.subject?.reference !== `Patient/${patientId}`)
      throw new Error(`Lab result ${reportId} not found`);
    const ids = getBasedOnServiceRequestIds(stored.report);
    if (ids.includes(requestId) === linked) return;
    const report = withBasedOnServiceRequests(
      stored.report,
      linked ? [...ids, requestId] : ids.filter((id) => id !== requestId)
    );
    // Observations are stored separately, as when saving the form.
    delete report.contained;
    report.meta = { ...report.meta, lastUpdated: new Date().toISOString() };
    await updateDiagnosticReportJson(report, patientId);
    changed = true;
  });
  if (changed) notifyDatabaseChanged(['diagnostic_reports']);
}
