import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { saveFile } from './fileExport';
import type {
  Patient,
  DiagnosticReport,
  Observation,
  Condition,
  Encounter,
  Composition,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  RequestOrchestration,
  Organization,
  ServiceRequest,
} from 'fhir/r5';
import { deriveKeyFromPassphrase, decryptText } from './cryptoService';
import { assertCBCObservation } from '@/src/features/lab-results/biomarkerMeasurements';
import {
  fetchAllPatients,
  insertPatientRecord,
  DEFAULT_PATIENT_ID,
} from '@/src/features/profile/patientRepository';
import {
  fetchAllDiagnosticReportRecords,
  insertDiagnosticReportRecord,
} from '@/src/features/lab-results/labResultsRepository';
import {
  fetchAllConditionRecords,
  insertConditionRecord,
} from '@/src/features/conditions/conditionsRepository';
import {
  fetchAllConsultationRecords,
  insertConsultationRecord,
} from '@/src/features/consultations/consultationsRepository';
import {
  fetchAllClinicalDocumentRecords,
  insertClinicalDocumentRecord,
} from '@/src/features/consultations/clinicalDocumentsRepository';
import {
  fetchAllMedicationRequestRecords,
  insertMedicationRequestRecord,
} from '@/src/features/treatments/treatmentsRepository';
import {
  fetchAllMedicationStatementRecords,
  insertMedicationStatementRecord,
} from '@/src/features/actions/medicationStatementsRepository';
import {
  fetchAllRequestOrchestrationRecords,
  insertRequestOrchestrationRecord,
} from '@/src/features/bundles/bundlesRepository';
import {
  fetchAllProfileSettingsRecords,
  insertProfileSettingsRecord,
  type ProfileSettingsRecord,
} from '@/src/features/settings/profileSettingsRepository';
import {
  fetchAllMedicationAdministrationRecords,
  insertMedicationAdministrationRecord,
} from '@/src/features/actions/medicationAdministrationsRepository';
import {
  fetchAllServiceRequestRecords,
  insertServiceRequestRecord,
} from '@/src/features/service-requests/serviceRequestsRepository';
import {
  fetchAllOrganizationRecords,
  insertOrganizationRecord,
} from '@/src/features/organizations/organizationsRepository';

export interface ZipExportSummary {
  patientCount: number;
  reportCount: number;
  conditionCount: number;
  consultationCount: number;
  clinicalDocumentCount: number;
  medicationRequestCount: number;
  medicationAdministrationCount: number;
  medicationStatementCount: number;
  serviceRequestCount: number;
  organizationCount: number;
  bundleCount: number;
  profileSettingsCount: number;
  fileName: string;
}

/**
 * Exports all local health records across all profiles into a standard Zip archive (unencrypted).
 */
export async function exportZipArchive(): Promise<ZipExportSummary> {
  const [
    patients,
    reportsWithObs,
    conditions,
    consultations,
    clinicalDocs,
    medicationRequests,
    medicationAdministrations,
    medicationStatements,
    serviceRequests,
    organizations,
    bundles,
    profileSettings,
  ] = await Promise.all([
    fetchAllPatients(),
    fetchAllDiagnosticReportRecords(),
    fetchAllConditionRecords(),
    fetchAllConsultationRecords(),
    fetchAllClinicalDocumentRecords(),
    fetchAllMedicationRequestRecords(),
    fetchAllMedicationAdministrationRecords(),
    fetchAllMedicationStatementRecords(),
    fetchAllServiceRequestRecords(),
    fetchAllOrganizationRecords(),
    fetchAllRequestOrchestrationRecords(),
    fetchAllProfileSettingsRecords(),
  ]);

  const zipFiles: Record<string, Uint8Array> = {};

  // Export Patients as plain JSON
  for (const pat of patients) {
    const jsonStr = JSON.stringify(pat, null, 2);
    zipFiles[`records/patient_${pat.id || 'default'}.json`] = strToU8(jsonStr);
  }

  // Export Reports as plain JSON
  for (const { report, observations } of reportsWithObs) {
    const bundle = {
      ...report,
      contained: observations,
    };
    const jsonStr = JSON.stringify(bundle, null, 2);
    zipFiles[`records/report_${report.id}.json`] = strToU8(jsonStr);
  }

  // Export Conditions as plain JSON
  for (const cond of conditions) {
    const jsonStr = JSON.stringify(cond, null, 2);
    zipFiles[`records/condition_${cond.id}.json`] = strToU8(jsonStr);
  }

  // Export Consultations as plain JSON
  for (const cons of consultations) {
    const jsonStr = JSON.stringify(cons, null, 2);
    zipFiles[`records/consultation_${cons.id}.json`] = strToU8(jsonStr);
  }

  // Export Clinical Documents (Compositions) as plain JSON
  for (const { document: doc, patientId } of clinicalDocs) {
    const jsonStr = JSON.stringify({ resource: doc, patientId }, null, 2);
    zipFiles[`records/clinical_document_${doc.id}.json`] = strToU8(jsonStr);
  }

  // Export Medication Requests as plain JSON
  for (const { request: req, patientId } of medicationRequests) {
    const jsonStr = JSON.stringify({ resource: req, patientId }, null, 2);
    zipFiles[`records/medication_request_${req.id}.json`] = strToU8(jsonStr);
  }

  // Export Medication Administrations (treatment logs) as plain JSON
  for (const { administration, patientId } of medicationAdministrations) {
    const jsonStr = JSON.stringify(
      { resource: administration, patientId },
      null,
      2
    );
    zipFiles[`records/medication_administration_${administration.id}.json`] =
      strToU8(jsonStr);
  }

  // Export Medication Statements (treatment usage periods) as plain JSON
  for (const { statement, patientId } of medicationStatements) {
    const jsonStr = JSON.stringify({ resource: statement, patientId }, null, 2);
    zipFiles[`records/medication_statement_${statement.id}.json`] =
      strToU8(jsonStr);
  }

  // Export Service Requests (service request) as plain JSON
  for (const { request, patientId } of serviceRequests) {
    const jsonStr = JSON.stringify({ resource: request, patientId }, null, 2);
    zipFiles[`records/service_request_${request.id}.json`] = strToU8(jsonStr);
  }

  // Export Organizations (service providers) with their owning patient
  for (const { organization, patientId } of organizations) {
    const jsonStr = JSON.stringify(
      { resource: organization, patientId },
      null,
      2
    );
    zipFiles[`records/organization_${organization.id}.json`] = strToU8(jsonStr);
  }

  // Export treatment bundles (RequestOrchestrations) with their patient
  for (const { bundle, patientId } of bundles) {
    const jsonStr = JSON.stringify({ resource: bundle, patientId }, null, 2);
    zipFiles[`records/request_orchestration_${bundle.id}.json`] =
      strToU8(jsonStr);
  }

  // Export each profile's settings (app infrastructure, not FHIR)
  for (const { settings, patientId } of profileSettings) {
    const jsonStr = JSON.stringify({ settings, patientId }, null, 2);
    zipFiles[`records/profile_settings_${patientId}.json`] = strToU8(jsonStr);
  }

  // Manifest v2 with FHIR version and complete resource inventory
  const manifest = {
    version: 2,
    fhirVersion: '5.0.0',
    exportedAt: new Date().toISOString(),
    patientCount: patients.length,
    reportCount: reportsWithObs.length,
    conditionCount: conditions.length,
    consultationCount: consultations.length,
    clinicalDocumentCount: clinicalDocs.length,
    medicationRequestCount: medicationRequests.length,
    medicationAdministrationCount: medicationAdministrations.length,
    medicationStatementCount: medicationStatements.length,
    serviceRequestCount: serviceRequests.length,
    organizationCount: organizations.length,
    bundleCount: bundles.length,
    profileSettingsCount: profileSettings.length,
  };
  zipFiles['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zippedBytes = zipSync(zipFiles);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `healthy_backup_${dateStr}.zip`;

  await saveFile(zippedBytes, fileName, {
    mimeType: 'application/zip',
    dialogTitle: 'Export Health Records',
    UTI: 'public.zip-archive',
  });

  return {
    patientCount: patients.length,
    reportCount: reportsWithObs.length,
    conditionCount: conditions.length,
    consultationCount: consultations.length,
    clinicalDocumentCount: clinicalDocs.length,
    medicationRequestCount: medicationRequests.length,
    medicationAdministrationCount: medicationAdministrations.length,
    medicationStatementCount: medicationStatements.length,
    serviceRequestCount: serviceRequests.length,
    organizationCount: organizations.length,
    bundleCount: bundles.length,
    profileSettingsCount: profileSettings.length,
    fileName,
  };
}

/**
 * Restores records from raw zip bytes into the local database from unencrypted (or legacy encrypted) JSON files.
 */
export async function restoreFromZipBytes(
  zipBytes: Uint8Array,
  legacyPassphrase: string = 'healthy-backup'
): Promise<{
  patients: number;
  reports: number;
  conditions: number;
  consultations: number;
  clinicalDocuments: number;
  medicationRequests: number;
  medicationAdministrations: number;
  medicationStatements: number;
  serviceRequests: number;
  organizations: number;
  bundles: number;
  profileSettings: number;
}> {
  const unzipped = unzipSync(zipBytes);

  let restoredPatients = 0;
  let restoredReports = 0;
  let restoredConditions = 0;
  let restoredConsultations = 0;
  let restoredClinicalDocuments = 0;
  let restoredMedicationRequests = 0;
  let restoredMedicationAdministrations = 0;
  let restoredMedicationStatements = 0;
  let restoredServiceRequests = 0;
  let restoredOrganizations = 0;
  let restoredBundles = 0;
  let restoredProfileSettings = 0;
  let legacyKey: import('expo-crypto').AESEncryptionKey | null = null;

  const patientResources: Patient[] = [];
  const conditionResources: { cond: Condition; patientId: string }[] = [];
  const reportResources: {
    report: DiagnosticReport;
    observations: Observation[];
    patientId: string;
  }[] = [];
  const consultationResources: { cons: Encounter; patientId: string }[] = [];
  const medicationRequestResources: {
    req: MedicationRequest;
    patientId: string;
  }[] = [];
  const medicationStatementResources: {
    statement: MedicationStatement;
    patientId: string;
  }[] = [];
  const medicationAdministrationResources: {
    administration: MedicationAdministration;
    patientId: string;
  }[] = [];
  const serviceRequestResources: {
    request: ServiceRequest;
    patientId: string;
  }[] = [];
  const compositionResources: { doc: Composition; patientId: string }[] = [];
  const profileSettingsRecords: {
    settings: ProfileSettingsRecord;
    patientId: string;
  }[] = [];
  const bundleResources: {
    bundle: RequestOrchestration;
    patientId: string;
  }[] = [];
  const organizationResources: {
    organization: Organization;
    patientId: string;
  }[] = [];

  for (const [path, fileBytes] of Object.entries(unzipped)) {
    let jsonText: string | null = null;

    if (path.endsWith('.json')) {
      // Standard unencrypted JSON file
      jsonText = strFromU8(fileBytes);
    } else if (path.endsWith('.json.enc')) {
      // Backward-compatible fallback for encrypted backup
      try {
        if (!legacyKey) {
          legacyKey = await deriveKeyFromPassphrase(legacyPassphrase);
        }
        if (legacyKey) {
          jsonText = await decryptText(fileBytes, legacyKey);
        }
      } catch (encErr) {
        console.warn('Failed to decrypt legacy file:', path, encErr);
      }
    }

    if (!jsonText) continue;

    try {
      const parsed = JSON.parse(jsonText);
      if (
        path.startsWith('records/profile_settings_') &&
        parsed.settings &&
        typeof parsed.patientId === 'string'
      ) {
        profileSettingsRecords.push({
          settings: parsed.settings,
          patientId: parsed.patientId,
        });
        continue;
      }
      const isClinicalEnvelope =
        path.startsWith('records/clinical_document_') &&
        parsed.resource?.resourceType === 'Composition';
      const isMedicationEnvelope =
        path.startsWith('records/medication_request_') &&
        parsed.resource?.resourceType === 'MedicationRequest';
      const isMedicationStatementEnvelope =
        path.startsWith('records/medication_statement_') &&
        parsed.resource?.resourceType === 'MedicationStatement';
      const isMedicationAdministrationEnvelope =
        path.startsWith('records/medication_administration_') &&
        parsed.resource?.resourceType === 'MedicationAdministration';
      const isServiceRequestEnvelope =
        path.startsWith('records/service_request_') &&
        parsed.resource?.resourceType === 'ServiceRequest';
      const isOrganizationEnvelope =
        path.startsWith('records/organization_') &&
        parsed.resource?.resourceType === 'Organization';
      const isBundleEnvelope =
        path.startsWith('records/request_orchestration_') &&
        parsed.resource?.resourceType === 'RequestOrchestration';
      const isEnvelope =
        isBundleEnvelope ||
        isClinicalEnvelope ||
        isMedicationEnvelope ||
        isMedicationAdministrationEnvelope ||
        isMedicationStatementEnvelope ||
        isServiceRequestEnvelope ||
        isOrganizationEnvelope;
      const resource = isEnvelope ? parsed.resource : parsed;
      const archivedPatientId =
        isEnvelope && typeof parsed.patientId === 'string'
          ? parsed.patientId
          : undefined;

      if (resource.resourceType === 'Patient') {
        patientResources.push(resource as Patient);
      } else if (resource.resourceType === 'Condition') {
        const cond = resource as Condition;
        const patientId =
          cond.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        conditionResources.push({ cond, patientId });
      } else if (resource.resourceType === 'DiagnosticReport') {
        // Observations are archived as `contained` but stored separately.
        const { contained, ...report } = resource as DiagnosticReport;
        const observations = (contained || []) as Observation[];
        const patientId =
          report.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        reportResources.push({ report, observations, patientId });
      } else if (resource.resourceType === 'Encounter') {
        const cons = resource as Encounter;
        const patientId =
          cons.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        consultationResources.push({ cons, patientId });
      } else if (resource.resourceType === 'MedicationRequest') {
        const req = resource as MedicationRequest;
        const patientId =
          archivedPatientId ||
          req.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        medicationRequestResources.push({ req, patientId });
      } else if (resource.resourceType === 'MedicationStatement') {
        const statement = resource as MedicationStatement;
        const patientId =
          archivedPatientId ||
          statement.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        medicationStatementResources.push({ statement, patientId });
      } else if (resource.resourceType === 'MedicationAdministration') {
        const administration = resource as MedicationAdministration;
        const patientId =
          archivedPatientId ||
          administration.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        medicationAdministrationResources.push({ administration, patientId });
      } else if (resource.resourceType === 'ServiceRequest') {
        const request = resource as ServiceRequest;
        const patientId =
          archivedPatientId ||
          request.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        serviceRequestResources.push({ request, patientId });
      } else if (resource.resourceType === 'Organization') {
        // Organizations have no subject; only the envelope names the patient.
        organizationResources.push({
          organization: resource as Organization,
          patientId: archivedPatientId || DEFAULT_PATIENT_ID,
        });
      } else if (resource.resourceType === 'RequestOrchestration') {
        const bundle = resource as RequestOrchestration;
        const patientId =
          archivedPatientId ||
          bundle.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        bundleResources.push({ bundle, patientId });
      } else if (resource.resourceType === 'Composition') {
        const doc = resource as Composition;
        const patientId =
          archivedPatientId ||
          doc.subject?.[0]?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        compositionResources.push({ doc, patientId });
      }
    } catch (err) {
      console.warn('Failed to parse record from zip:', path, err);
    }
  }

  // Validate every lab result before writing any archive resources.
  for (const { observations } of reportResources) {
    observations.forEach(assertCBCObservation);
  }

  // Restore in dependency order: Patients -> ProfileSettings -> Organizations -> Conditions -> DiagnosticReports -> Encounters -> MedicationRequests -> MedicationStatements -> MedicationAdministrations -> ServiceRequests -> RequestOrchestrations -> Compositions
  for (const patient of patientResources) {
    try {
      await insertPatientRecord(patient);
      restoredPatients++;
    } catch (err) {
      console.warn('Failed to insert patient record from zip:', err);
    }
  }

  for (const { settings, patientId } of profileSettingsRecords) {
    try {
      await insertProfileSettingsRecord(settings, patientId);
      restoredProfileSettings++;
    } catch (err) {
      console.warn('Failed to insert profile settings from zip:', err);
    }
  }

  for (const { organization, patientId } of organizationResources) {
    try {
      await insertOrganizationRecord(organization, patientId);
      restoredOrganizations++;
    } catch (err) {
      console.warn('Failed to insert organization record from zip:', err);
    }
  }

  for (const { cond, patientId } of conditionResources) {
    try {
      await insertConditionRecord(cond, patientId);
      restoredConditions++;
    } catch (err) {
      console.warn('Failed to insert condition record from zip:', err);
    }
  }

  for (const { report, observations, patientId } of reportResources) {
    try {
      await insertDiagnosticReportRecord(report, observations, patientId);
      restoredReports++;
    } catch (err) {
      console.warn('Failed to insert diagnostic report record from zip:', err);
    }
  }

  for (const { cons, patientId } of consultationResources) {
    try {
      await insertConsultationRecord(cons, patientId);
      restoredConsultations++;
    } catch (err) {
      console.warn('Failed to insert consultation record from zip:', err);
    }
  }

  for (const { req, patientId } of medicationRequestResources) {
    try {
      await insertMedicationRequestRecord(req, patientId);
      restoredMedicationRequests++;
    } catch (err) {
      console.warn('Failed to insert medication request record from zip:', err);
    }
  }

  for (const { statement, patientId } of medicationStatementResources) {
    try {
      await insertMedicationStatementRecord(statement, patientId);
      restoredMedicationStatements++;
    } catch (err) {
      console.warn('Failed to insert treatment usage record from zip:', err);
    }
  }

  for (const {
    administration,
    patientId,
  } of medicationAdministrationResources) {
    try {
      await insertMedicationAdministrationRecord(administration, patientId);
      restoredMedicationAdministrations++;
    } catch (err) {
      console.warn('Failed to insert treatment log record from zip:', err);
    }
  }

  for (const { request, patientId } of serviceRequestResources) {
    try {
      await insertServiceRequestRecord(request, patientId);
      restoredServiceRequests++;
    } catch (err) {
      console.warn('Failed to insert service request record from zip:', err);
    }
  }

  for (const { bundle, patientId } of bundleResources) {
    try {
      await insertRequestOrchestrationRecord(bundle, patientId);
      restoredBundles++;
    } catch (err) {
      console.warn('Failed to insert treatment bundle record from zip:', err);
    }
  }

  for (const { doc, patientId } of compositionResources) {
    try {
      await insertClinicalDocumentRecord(doc, patientId);
      restoredClinicalDocuments++;
    } catch (err) {
      console.warn('Failed to insert clinical document record from zip:', err);
    }
  }

  return {
    patients: restoredPatients,
    reports: restoredReports,
    conditions: restoredConditions,
    consultations: restoredConsultations,
    clinicalDocuments: restoredClinicalDocuments,
    medicationRequests: restoredMedicationRequests,
    medicationAdministrations: restoredMedicationAdministrations,
    medicationStatements: restoredMedicationStatements,
    serviceRequests: restoredServiceRequests,
    organizations: restoredOrganizations,
    bundles: restoredBundles,
    profileSettings: restoredProfileSettings,
  };
}
