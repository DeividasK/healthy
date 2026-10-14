import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type {
  Patient,
  DiagnosticReport,
  Observation,
  Condition,
  Encounter,
  Composition,
  MedicationRequest,
} from 'fhir/r5';
import { deriveKeyFromPassphrase, decryptText } from './cryptoService';
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

export interface ZipExportSummary {
  patientCount: number;
  reportCount: number;
  conditionCount: number;
  consultationCount: number;
  clinicalDocumentCount: number;
  medicationRequestCount: number;
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
  ] = await Promise.all([
    fetchAllPatients(),
    fetchAllDiagnosticReportRecords(),
    fetchAllConditionRecords(),
    fetchAllConsultationRecords(),
    fetchAllClinicalDocumentRecords(),
    fetchAllMedicationRequestRecords(),
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
  };
  zipFiles['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));

  const zippedBytes = zipSync(zipFiles);
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `healthy_backup_${dateStr}.zip`;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([zippedBytes as BlobPart], {
      type: 'application/zip',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    // Native iOS / Android (Expo SDK 57 File API)
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(zippedBytes);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/zip',
        dialogTitle: 'Export Health Records',
        UTI: 'public.zip-archive',
      });
    }
  }

  return {
    patientCount: patients.length,
    reportCount: reportsWithObs.length,
    conditionCount: conditions.length,
    consultationCount: consultations.length,
    clinicalDocumentCount: clinicalDocs.length,
    medicationRequestCount: medicationRequests.length,
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
}> {
  const unzipped = unzipSync(zipBytes);

  let restoredPatients = 0;
  let restoredReports = 0;
  let restoredConditions = 0;
  let restoredConsultations = 0;
  let restoredClinicalDocuments = 0;
  let restoredMedicationRequests = 0;
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
  const compositionResources: { doc: Composition; patientId: string }[] = [];

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
      const isClinicalEnvelope =
        path.startsWith('records/clinical_document_') &&
        parsed.resource?.resourceType === 'Composition';
      const isMedicationEnvelope =
        path.startsWith('records/medication_request_') &&
        parsed.resource?.resourceType === 'MedicationRequest';
      const resource =
        isClinicalEnvelope || isMedicationEnvelope ? parsed.resource : parsed;
      const archivedPatientId =
        (isClinicalEnvelope || isMedicationEnvelope) &&
        typeof parsed.patientId === 'string'
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
        const report = resource as DiagnosticReport;
        const observations = (report.contained || []) as Observation[];
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

  // Restore in dependency order: Patients -> Conditions -> DiagnosticReports -> Encounters -> MedicationRequests -> Compositions
  for (const patient of patientResources) {
    try {
      await insertPatientRecord(patient);
      restoredPatients++;
    } catch (err) {
      console.warn('Failed to insert patient record from zip:', err);
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
      await insertMedicationRequestRecord(req, patientId, true);
      restoredMedicationRequests++;
    } catch (err) {
      console.warn('Failed to insert medication request record from zip:', err);
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
  };
}
