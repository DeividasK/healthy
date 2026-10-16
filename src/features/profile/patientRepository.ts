import type { Patient } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';

export const DEFAULT_PATIENT_ID = 'patient-default';

/**
 * Persists a Patient record using SQLite.
 */
export async function insertPatientRecord(
  patient: Patient,
  withinTransaction: boolean = false
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

  const persist = async () => {
    await db.runAsync(
      `INSERT INTO patients (id, given_name, family_name, gender, birth_date, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         given_name = excluded.given_name,
         family_name = excluded.family_name,
         gender = excluded.gender,
         birth_date = excluded.birth_date,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        patient.id!,
        givenName,
        familyName,
        gender,
        birthDate,
        JSON.stringify(patientWithMeta),
        now,
        incomingTimestamp,
      ]
    );
  };
  if (withinTransaction) await persist();
  else await db.withTransactionAsync(persist);

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
 * Deletes a Patient record by ID. Also removes associated records via cascade.
 * Captured as deletions, so synced devices delete the profile too.
 */
export async function deletePatientRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM patients WHERE id = ?;`, [id]);
  });
  notifyDatabaseChanged([
    'patients',
    'conditions',
    'consultations',
    'consultation_conditions',
    'medication_requests',
    'service_requests',
    'medication_administrations',
    'medication_statements',
    'clinical_documents',
    'organizations',
  ]);
}

/**
 * Gets the current active patient ID from app_settings.
 */
export async function getActivePatientId(): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM app_settings WHERE key = 'active_patient_id';`
  );
  return row?.value || '';
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
 * Clears active patient ID in app_settings.
 */
export async function clearActivePatientId(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM app_settings WHERE key = 'active_patient_id';`
  );
  notifyDatabaseChanged(['app_settings']);
}
