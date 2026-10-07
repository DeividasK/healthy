import type { Patient } from 'fhir/r5';
import { getDb } from '../../database/db';
import { notifyDatabaseChanged } from '../../database/dbEvents';

export const DEFAULT_PATIENT_ID = 'patient-default';

export interface StoredPatient {
  patient: Patient;
  syncAccount?: string | null;
}

/**
 * Persists a Patient record using SQLite.
 */
export async function insertPatientRecord(
  patient: Patient,
  syncAccount?: string | null
): Promise<void> {
  if (!patient.id) {
    throw new Error('Patient requires an id to be persisted');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = patient.meta?.lastUpdated || now;
  const patientWithMeta: Patient = {
    ...patient,
    meta: {
      ...patient.meta,
      lastUpdated: incomingTimestamp,
    },
  };
  const givenName =
    patient.name?.[0]?.given?.[0] || patient.name?.[0]?.text || 'Unknown';
  const familyName = patient.name?.[0]?.family || null;
  const gender = patient.gender || null;
  const birthDate = patient.birthDate || null;
  const patientId = patient.id;

  const existing = await db.getFirstAsync<{ updated_at: string }>(
    `SELECT updated_at FROM patients WHERE id = ?;`,
    [patientId]
  );
  if (existing?.updated_at && incomingTimestamp) {
    if (existing.updated_at >= incomingTimestamp) {
      return;
    }
  }

  await db.runAsync(
    `INSERT INTO patients (id, given_name, family_name, gender, birth_date, fhir_json, sync_account, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       given_name = excluded.given_name,
       family_name = excluded.family_name,
       gender = excluded.gender,
       birth_date = excluded.birth_date,
       fhir_json = excluded.fhir_json,
       sync_account = COALESCE(excluded.sync_account, patients.sync_account),
       updated_at = excluded.updated_at;`,
    [
      patientId,
      givenName,
      familyName,
      gender,
      birthDate,
      JSON.stringify(patientWithMeta),
      syncAccount ?? null,
      now,
      incomingTimestamp,
    ]
  );

  notifyDatabaseChanged(['patients']);
}

/**
 * Retrieves all stored Patient records from SQLite.
 */
export async function fetchAllPatients(): Promise<Patient[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM patients ORDER BY created_at ASC, id ASC;`
  );
  return rows.map((r) => {
    const pat: Patient = JSON.parse(r.fhir_json);
    if (!pat.meta?.lastUpdated && r.updated_at) {
      pat.meta = { ...pat.meta, lastUpdated: r.updated_at };
    }
    return pat;
  });
}

/**
 * Retrieves all stored Patient records along with their sync_account.
 */
export async function fetchAllStoredPatients(): Promise<StoredPatient[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    sync_account: string | null;
    updated_at: string;
  }>(
    `SELECT fhir_json, sync_account, updated_at FROM patients ORDER BY created_at ASC, id ASC;`
  );
  return rows.map((r) => {
    const pat: Patient = JSON.parse(r.fhir_json);
    if (!pat.meta?.lastUpdated && r.updated_at) {
      pat.meta = { ...pat.meta, lastUpdated: r.updated_at };
    }
    return {
      patient: pat,
      syncAccount: r.sync_account,
    };
  });
}

/**
 * Counts total patients in SQLite.
 */
export async function countPatients(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM patients;`
  );
  return row?.count ?? 0;
}

/**
 * Retrieves a Patient record by ID.
 */
export async function fetchPatientById(id: string): Promise<Patient | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM patients WHERE id = ?;`,
    [id]
  );
  if (!row) return null;
  const pat: Patient = JSON.parse(row.fhir_json);
  if (!pat.meta?.lastUpdated && row.updated_at) {
    pat.meta = { ...pat.meta, lastUpdated: row.updated_at };
  }
  return pat;
}

/**
 * Retrieves a Patient record with syncAccount by ID.
 */
export async function fetchStoredPatientById(
  id: string
): Promise<StoredPatient | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    sync_account: string | null;
    updated_at: string;
  }>(`SELECT fhir_json, sync_account, updated_at FROM patients WHERE id = ?;`, [
    id,
  ]);
  if (!row) return null;
  const pat: Patient = JSON.parse(row.fhir_json);
  if (!pat.meta?.lastUpdated && row.updated_at) {
    pat.meta = { ...pat.meta, lastUpdated: row.updated_at };
  }
  return {
    patient: pat,
    syncAccount: row.sync_account,
  };
}

/**
 * Deletes a Patient record by ID. Also removes associated records via cascade.
 */
export async function deletePatientRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM patients WHERE id = ?;`, [id]);
  notifyDatabaseChanged(['patients']);
}

/**
 * Gets the current active patient ID from app_settings.
 */
export async function getActivePatientId(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'active_patient_id';`
  );
  return row?.value || DEFAULT_PATIENT_ID;
}

/**
 * Sets the current active patient ID in app_settings.
 */
export async function setActivePatientId(patientId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO app_settings (key, value) VALUES ('active_patient_id', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [patientId]
  );
  notifyDatabaseChanged(['app_settings']);
}

/**
 * Updates the sync_account associated with a patient.
 */
export async function updatePatientSyncAccount(
  id: string,
  syncAccount: string | null
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE patients SET sync_account = ?, updated_at = ? WHERE id = ?;`,
    [syncAccount, new Date().toISOString(), id]
  );
  notifyDatabaseChanged(['patients']);
}

/**
 * Clears active patient ID in app_settings.
 */
export async function clearActivePatientId(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM app_settings WHERE key = 'active_patient_id';`
  );
  notifyDatabaseChanged(['app_settings']);
}
