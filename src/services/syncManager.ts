import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Patient,
  DiagnosticReport,
  Observation,
  Condition,
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
} from './googleDriveService';
import {
  fetchAllPatients,
  insertPatientRecord,
  DEFAULT_PATIENT_ID,
} from '../features/profile/patientRepository';
import {
  fetchAllDiagnosticReportRecords,
  insertDiagnosticReportRecord,
} from '../features/lab-results/labResultsRepository';
import {
  fetchAllConditionRecords,
  insertConditionRecord,
} from '../features/conditions/conditionsRepository';

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
 * Backs up all local records to Google Drive appDataFolder.
 */
export async function backupToGoogleDrive(
  config: GoogleDriveConfig
): Promise<{ patients: number; reports: number; conditions: number }> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);
  const remoteFileMap = new Map<string, string>(
    remoteFiles.map((f) => [f.name, f.id])
  );

  const [patients, reportsWithObs, conditions] = await Promise.all([
    fetchAllPatients(),
    fetchAllDiagnosticReportRecords(),
    fetchAllConditionRecords(),
  ]);

  // Upload/Update Patients
  for (const pat of patients) {
    const fileName = `patient_${pat.id || 'default'}.json.enc`;
    const encBytes = await encryptText(JSON.stringify(pat), key);
    const existingId = remoteFileMap.get(fileName);
    if (existingId) {
      await updateAppDataFile(config.accessToken, existingId, encBytes);
    } else {
      await uploadAppDataFile(config.accessToken, fileName, encBytes);
    }
  }

  // Upload/Update Diagnostic Reports
  for (const { report, observations } of reportsWithObs) {
    const fileName = `report_${report.id}.json.enc`;
    const bundle = {
      ...report,
      contained: observations,
    };
    const encBytes = await encryptText(JSON.stringify(bundle), key);
    const existingId = remoteFileMap.get(fileName);
    if (existingId) {
      await updateAppDataFile(config.accessToken, existingId, encBytes);
    } else {
      await uploadAppDataFile(config.accessToken, fileName, encBytes);
    }
  }

  // Upload/Update Conditions
  for (const cond of conditions) {
    const fileName = `condition_${cond.id}.json.enc`;
    const encBytes = await encryptText(JSON.stringify(cond), key);
    const existingId = remoteFileMap.get(fileName);
    if (existingId) {
      await updateAppDataFile(config.accessToken, existingId, encBytes);
    } else {
      await uploadAppDataFile(config.accessToken, fileName, encBytes);
    }
  }

  // Update last sync timestamp
  const updatedConfig: GoogleDriveConfig = {
    ...config,
    lastSyncTimestamp: new Date().toISOString(),
  };
  await saveGoogleDriveConfig(updatedConfig);

  return {
    patients: patients.length,
    reports: reportsWithObs.length,
    conditions: conditions.length,
  };
}

/**
 * Restores records from Google Drive appDataFolder into the local database.
 */
export async function restoreFromGoogleDrive(
  config: GoogleDriveConfig
): Promise<{ patients: number; reports: number; conditions: number }> {
  const key = await deriveKeyFromGoogleUser(config.userSub);
  const remoteFiles = await listAppDataFiles(config.accessToken);

  let restoredPatients = 0;
  let restoredReports = 0;
  let restoredConditions = 0;

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
      }
    } catch (err) {
      console.warn('Failed to restore file from Google Drive:', file.name, err);
    }
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
  };
}

/**
 * Performs full two-way incremental sync between local database and Google Drive.
 */
export async function syncWithGoogleDrive(
  config: GoogleDriveConfig
): Promise<{ patients: number; reports: number; conditions: number }> {
  // 1. Pull down remote records first
  const restored = await restoreFromGoogleDrive(config);
  // 2. Push any local records up
  await backupToGoogleDrive(config);
  return restored;
}
