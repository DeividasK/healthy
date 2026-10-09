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

export interface ZipExportSummary {
  patientCount: number;
  reportCount: number;
  conditionCount: number;
  consultationCount: number;
  fileName: string;
}

/**
 * Exports all local health records across all profiles into a standard Zip archive (unencrypted).
 */
export async function exportZipArchive(): Promise<ZipExportSummary> {
  const [patients, reportsWithObs, conditions, consultations] =
    await Promise.all([
      fetchAllPatients(),
      fetchAllDiagnosticReportRecords(),
      fetchAllConditionRecords(),
      fetchAllConsultationRecords(),
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

  // Manifest as plain JSON
  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    patientCount: patients.length,
    reportCount: reportsWithObs.length,
    conditionCount: conditions.length,
    consultationCount: consultations.length,
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
}> {
  const unzipped = unzipSync(zipBytes);

  let restoredPatients = 0;
  let restoredReports = 0;
  let restoredConditions = 0;
  let restoredConsultations = 0;
  let legacyKey: import('expo-crypto').AESEncryptionKey | null = null;

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
      const resource = JSON.parse(jsonText);

      if (resource.resourceType === 'Patient') {
        await insertPatientRecord(resource as Patient);
        restoredPatients++;
      } else if (resource.resourceType === 'DiagnosticReport') {
        const report = resource as DiagnosticReport;
        const observations = (report.contained || []) as Observation[];
        const patientId =
          report.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        await insertDiagnosticReportRecord(report, observations, patientId);
        restoredReports++;
      } else if (resource.resourceType === 'Condition') {
        const cond = resource as Condition;
        const patientId =
          cond.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        await insertConditionRecord(cond, patientId);
        restoredConditions++;
      } else if (resource.resourceType === 'Encounter') {
        const cons = resource as Encounter;
        const patientId =
          cons.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        await insertConsultationRecord(cons, patientId);
        restoredConsultations++;
      }
    } catch (err) {
      console.warn('Failed to parse record from zip:', path, err);
    }
  }

  return {
    patients: restoredPatients,
    reports: restoredReports,
    conditions: restoredConditions,
    consultations: restoredConsultations,
  };
}
