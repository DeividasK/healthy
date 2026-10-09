import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Patient,
  DiagnosticReport,
  Observation,
  Condition,
  Encounter,
} from 'fhir/r5';
import {
  deriveKeyFromGoogleUser,
  encryptText,
  decryptText,
} from './cryptoService';
import {
  listAppDataFiles,
  uploadAppDataFile,
  updateAppDataFile,
  downloadAppDataFile,
  deleteAppDataFile,
  type GoogleDriveFile,
} from './googleDriveService';
import {
  fetchAllStoredPatients,
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
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { isExistingNewerOrEqual } from '@/src/utils/dateUtils';

export const GOOGLE_DRIVE_STORAGE_KEY = '@healthy_device_google_sync_config';

export interface GoogleDriveConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userEmail?: string;
  userName?: string;
  userSub: string;
  lastSyncTimestamp?: string;
}

/**
 * Refreshes an expired Google access token using the stored refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const tokenEndpoint = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Loads device-only Google Drive sync configuration from AsyncStorage.
 */
export async function loadGoogleDriveConfig(): Promise<GoogleDriveConfig | null> {
  try {
    const raw = await AsyncStorage.getItem(GOOGLE_DRIVE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GoogleDriveConfig;
  } catch (err) {
    console.warn('Failed to load Google Drive sync config:', err);
    return null;
  }
}

/**
 * Saves or clears device-only Google Drive sync configuration in AsyncStorage.
 */
export async function saveGoogleDriveConfig(
  config: GoogleDriveConfig | null
): Promise<void> {
  try {
    if (!config) {
      await AsyncStorage.removeItem(GOOGLE_DRIVE_STORAGE_KEY);
    } else {
      await AsyncStorage.setItem(
        GOOGLE_DRIVE_STORAGE_KEY,
        JSON.stringify(config)
      );
    }
  } catch (err) {
    console.error('Failed to save Google Drive sync config:', err);
    throw err;
  }
}

/**
 * Backs up local records to Google Drive appDataFolder.
 * Only uploads records for patients connected to this Google account (or all if not tagged).
 */
export async function backupToGoogleDrive(config: GoogleDriveConfig): Promise<{
  patients: number;
  reports: number;
  conditions: number;
  consultations: number;
}> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);
  const remoteFileMap = new Map<string, GoogleDriveFile>(
    remoteFiles.map((f) => [f.name, f])
  );

  const [
    allStoredPatients,
    allReportsWithObs,
    allConditions,
    allConsultations,
  ] = await Promise.all([
    fetchAllStoredPatients(),
    fetchAllDiagnosticReportRecords(),
    fetchAllConditionRecords(),
    fetchAllConsultationRecords(),
  ]);

  // Filter to patients explicitly connected to this Google account
  const eligiblePatients = allStoredPatients.filter(
    (sp) => sp.syncAccount === config.userSub
  );
  const eligiblePatientIds = new Set(
    eligiblePatients.map((sp) => sp.patient.id || 'default')
  );

  const eligibleReports = allReportsWithObs.filter((r) => {
    const patientId =
      r.report.subject?.reference?.replace(/^Patient\//, '') ||
      DEFAULT_PATIENT_ID;
    return eligiblePatientIds.has(patientId);
  });

  const eligibleConditions = allConditions.filter((c) => {
    const patientId =
      c.subject?.reference?.replace(/^Patient\//, '') || DEFAULT_PATIENT_ID;
    return eligiblePatientIds.has(patientId);
  });

  const eligibleConsultations = allConsultations.filter((cons) => {
    const patientId =
      cons.subject?.reference?.replace(/^Patient\//, '') || DEFAULT_PATIENT_ID;
    return eligiblePatientIds.has(patientId);
  });

  // Upload/Update Eligible Patients
  for (const { patient: pat } of eligiblePatients) {
    const fileName = `patient_${pat.id || 'default'}.json.enc`;
    const encBytes = await encryptText(JSON.stringify(pat), key);
    const existing = remoteFileMap.get(fileName);
    const localLastUpdated = pat.meta?.lastUpdated;
    const appProperties = localLastUpdated
      ? { lastUpdated: localLastUpdated }
      : undefined;

    if (existing) {
      const remoteLastUpdated = existing.appProperties?.lastUpdated;
      if (
        remoteLastUpdated &&
        localLastUpdated &&
        isExistingNewerOrEqual(remoteLastUpdated, localLastUpdated)
      ) {
        continue;
      }
      await updateAppDataFile(
        config.accessToken,
        existing.id,
        encBytes,
        appProperties
      );
    } else {
      await uploadAppDataFile(
        config.accessToken,
        fileName,
        encBytes,
        appProperties
      );
    }
  }

  // Upload/Update Diagnostic Reports
  for (const { report, observations } of eligibleReports) {
    const fileName = `report_${report.id}.json.enc`;
    const bundle = {
      ...report,
      contained: observations,
    };
    const encBytes = await encryptText(JSON.stringify(bundle), key);
    const existing = remoteFileMap.get(fileName);
    const localLastUpdated = report.meta?.lastUpdated;
    const appProperties = localLastUpdated
      ? { lastUpdated: localLastUpdated }
      : undefined;

    if (existing) {
      const remoteLastUpdated = existing.appProperties?.lastUpdated;
      if (
        remoteLastUpdated &&
        localLastUpdated &&
        isExistingNewerOrEqual(remoteLastUpdated, localLastUpdated)
      ) {
        continue;
      }
      await updateAppDataFile(
        config.accessToken,
        existing.id,
        encBytes,
        appProperties
      );
    } else {
      await uploadAppDataFile(
        config.accessToken,
        fileName,
        encBytes,
        appProperties
      );
    }
  }

  // Upload/Update Conditions
  for (const cond of eligibleConditions) {
    const fileName = `condition_${cond.id}.json.enc`;
    const encBytes = await encryptText(JSON.stringify(cond), key);
    const existing = remoteFileMap.get(fileName);
    const localLastUpdated = cond.meta?.lastUpdated;
    const appProperties = localLastUpdated
      ? { lastUpdated: localLastUpdated }
      : undefined;

    if (existing) {
      const remoteLastUpdated = existing.appProperties?.lastUpdated;
      if (
        remoteLastUpdated &&
        localLastUpdated &&
        isExistingNewerOrEqual(remoteLastUpdated, localLastUpdated)
      ) {
        continue;
      }
      await updateAppDataFile(
        config.accessToken,
        existing.id,
        encBytes,
        appProperties
      );
    } else {
      await uploadAppDataFile(
        config.accessToken,
        fileName,
        encBytes,
        appProperties
      );
    }
  }

  // Upload/Update Consultations
  for (const cons of eligibleConsultations) {
    const fileName = `consultation_${cons.id}.json.enc`;
    const encBytes = await encryptText(JSON.stringify(cons), key);
    const existing = remoteFileMap.get(fileName);
    const localLastUpdated = cons.meta?.lastUpdated;
    const appProperties = localLastUpdated
      ? { lastUpdated: localLastUpdated }
      : undefined;

    if (existing) {
      const remoteLastUpdated = existing.appProperties?.lastUpdated;
      if (
        remoteLastUpdated &&
        localLastUpdated &&
        isExistingNewerOrEqual(remoteLastUpdated, localLastUpdated)
      ) {
        continue;
      }
      await updateAppDataFile(
        config.accessToken,
        existing.id,
        encBytes,
        appProperties
      );
    } else {
      await uploadAppDataFile(
        config.accessToken,
        fileName,
        encBytes,
        appProperties
      );
    }
  }

  // Update last sync timestamp
  const updatedConfig: GoogleDriveConfig = {
    ...config,
    lastSyncTimestamp: new Date().toISOString(),
  };
  await saveGoogleDriveConfig(updatedConfig);

  return {
    patients: eligiblePatients.length,
    reports: eligibleReports.length,
    conditions: eligibleConditions.length,
    consultations: eligibleConsultations.length,
  };
}

/**
 * Inspects remote Google Drive appDataFolder and returns list of remote patients without importing all records.
 */
export async function listRemoteGooglePatients(
  config: GoogleDriveConfig
): Promise<Patient[]> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);
  const remotePatients: Patient[] = [];

  for (const file of remoteFiles) {
    if (file.name.startsWith('patient_') && file.name.endsWith('.json.enc')) {
      try {
        const encryptedBytes = await downloadAppDataFile(
          config.accessToken,
          file.id
        );
        const decryptedText = await decryptText(encryptedBytes, key);
        const resource = JSON.parse(decryptedText);
        if (resource.resourceType === 'Patient') {
          remotePatients.push(resource as Patient);
        }
      } catch (err) {
        console.warn('Failed to parse remote patient:', file.name, err);
      }
    }
  }

  return remotePatients;
}

/**
 * Restores records from Google Drive appDataFolder into the local database.
 * If targetPatientIds is provided, only restores those patients and their records.
 */
export async function restoreFromGoogleDrive(
  config: GoogleDriveConfig,
  targetPatientIds?: string[]
): Promise<{
  patients: number;
  reports: number;
  conditions: number;
  consultations: number;
}> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);
  const allowedPatientIdSet = targetPatientIds
    ? new Set(targetPatientIds)
    : null;

  let restoredPatients = 0;
  let restoredReports = 0;
  let restoredConditions = 0;
  let restoredConsultations = 0;

  for (const file of remoteFiles) {
    if (!file.name.endsWith('.json.enc')) continue;
    try {
      const encryptedBytes = await downloadAppDataFile(
        config.accessToken,
        file.id
      );
      const decryptedText = await decryptText(encryptedBytes, key);
      const resource = JSON.parse(decryptedText);

      if (resource.resourceType === 'Patient') {
        const pat = resource as Patient;
        if (!pat.meta?.lastUpdated) {
          pat.meta = {
            ...pat.meta,
            lastUpdated:
              file.appProperties?.lastUpdated ||
              file.modifiedTime ||
              '1970-01-01T00:00:00.000Z',
          };
        }
        if (
          !allowedPatientIdSet ||
          (pat.id && allowedPatientIdSet.has(pat.id))
        ) {
          await insertPatientRecord(pat, config.userSub, true);
          restoredPatients++;
        }
      } else if (resource.resourceType === 'DiagnosticReport') {
        const report = resource as DiagnosticReport;
        if (!report.meta?.lastUpdated) {
          report.meta = {
            ...report.meta,
            lastUpdated:
              file.appProperties?.lastUpdated ||
              file.modifiedTime ||
              '1970-01-01T00:00:00.000Z',
          };
        }
        const observations = (report.contained || []) as Observation[];
        const patientId =
          report.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        if (!allowedPatientIdSet || allowedPatientIdSet.has(patientId)) {
          await insertDiagnosticReportRecord(
            report,
            observations,
            patientId,
            true
          );
          restoredReports++;
        }
      } else if (resource.resourceType === 'Condition') {
        const cond = resource as Condition;
        if (!cond.meta?.lastUpdated) {
          cond.meta = {
            ...cond.meta,
            lastUpdated:
              file.appProperties?.lastUpdated ||
              file.modifiedTime ||
              '1970-01-01T00:00:00.000Z',
          };
        }
        const patientId =
          cond.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        if (!allowedPatientIdSet || allowedPatientIdSet.has(patientId)) {
          await insertConditionRecord(cond, patientId, true);
          restoredConditions++;
        }
      } else if (resource.resourceType === 'Encounter') {
        const cons = resource as Encounter;
        if (!cons.meta?.lastUpdated) {
          cons.meta = {
            ...cons.meta,
            lastUpdated:
              file.appProperties?.lastUpdated ||
              file.modifiedTime ||
              '1970-01-01T00:00:00.000Z',
          };
        }
        const patientId =
          cons.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;
        if (!allowedPatientIdSet || allowedPatientIdSet.has(patientId)) {
          await insertConsultationRecord(cons, patientId, undefined, true);
          restoredConsultations++;
        }
      }
    } catch (err) {
      console.warn('Failed to restore file from Google Drive:', file.name, err);
    }
  }

  if (
    restoredPatients > 0 ||
    restoredReports > 0 ||
    restoredConditions > 0 ||
    restoredConsultations > 0
  ) {
    notifyDatabaseChanged([
      'patients',
      'conditions',
      'diagnostic_reports',
      'consultations',
    ]);
  }

  const updatedConfig: GoogleDriveConfig = {
    ...config,
    lastSyncTimestamp: new Date().toISOString(),
  };
  await saveGoogleDriveConfig(updatedConfig);

  return {
    patients: restoredPatients,
    reports: restoredReports,
    conditions: restoredConditions,
    consultations: restoredConsultations,
  };
}

/**
 * Performs full two-way incremental sync between local database and Google Drive.
 * ONLY syncs profiles that are currently active/stored locally and marked for sync with this Google account.
 */
export async function syncWithGoogleDrive(config: GoogleDriveConfig): Promise<{
  patients: number;
  reports: number;
  conditions: number;
  consultations: number;
}> {
  const allStoredPatients = await fetchAllStoredPatients();
  const eligiblePatients = allStoredPatients.filter(
    (sp) => sp.syncAccount === config.userSub
  );
  const eligiblePatientIds = eligiblePatients
    .map((sp) => sp.patient.id)
    .filter((id): id is string => Boolean(id));

  // 1. Pull down remote records only for local eligible patients (or none if empty array)
  const restored = await restoreFromGoogleDrive(config, eligiblePatientIds);
  // 2. Push any local records up for eligible patients
  await backupToGoogleDrive(config);
  return restored;
}

/**
 * Deletes a patient and all their associated reports and conditions from Google Drive appDataFolder.
 */
export async function deletePatientFromGoogleDrive(
  config: GoogleDriveConfig,
  patientId: string
): Promise<{ deletedFiles: number }> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);
  let deletedCount = 0;

  for (const file of remoteFiles) {
    if (!file.name.endsWith('.json.enc')) continue;

    // Check direct patient file
    if (file.name === `patient_${patientId}.json.enc`) {
      try {
        await deleteAppDataFile(config.accessToken, file.id);
        deletedCount++;
      } catch (err) {
        console.warn(
          'Failed to delete patient file from Google Drive:',
          file.name,
          err
        );
      }
      continue;
    }

    // Check report, condition, or consultation files belonging to this patient
    if (
      file.name.startsWith('report_') ||
      file.name.startsWith('condition_') ||
      file.name.startsWith('consultation_')
    ) {
      try {
        const encryptedBytes = await downloadAppDataFile(
          config.accessToken,
          file.id
        );
        const decryptedText = await decryptText(encryptedBytes, key);
        const resource = JSON.parse(decryptedText);

        const resourcePatientId =
          resource.subject?.reference?.replace(/^Patient\//, '') ||
          DEFAULT_PATIENT_ID;

        if (resourcePatientId === patientId) {
          await deleteAppDataFile(config.accessToken, file.id);
          deletedCount++;
        }
      } catch (err) {
        console.warn(
          'Failed to inspect/delete remote file for patient:',
          file.name,
          err
        );
      }
    }
  }

  const updatedConfig: GoogleDriveConfig = {
    ...config,
    lastSyncTimestamp: new Date().toISOString(),
  };
  await saveGoogleDriveConfig(updatedConfig);

  return { deletedFiles: deletedCount };
}

/**
 * Deletes all encrypted app data files from Google Drive appDataFolder.
 */
export async function deleteAllAppDataFromGoogleDrive(
  config: GoogleDriveConfig
): Promise<{ deletedFiles: number }> {
  const remoteFiles = await listAppDataFiles(config.accessToken);
  let deletedCount = 0;

  for (const file of remoteFiles) {
    if (file.name.endsWith('.json.enc')) {
      try {
        await deleteAppDataFile(config.accessToken, file.id);
        deletedCount++;
      } catch (err) {
        console.warn(
          'Failed to delete app data file from Google Drive:',
          file.name,
          err
        );
      }
    }
  }

  return { deletedFiles: deletedCount };
}
