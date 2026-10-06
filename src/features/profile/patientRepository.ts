import type { Patient } from 'fhir/r5';
import { getDb } from '../../database/db';

export const DEFAULT_PATIENT_ID = 'patient-default';

/**
 * Persists a Patient record using SQLite.
 */
export async function insertPatientRecord(patient: Patient): Promise<void> {
  if (!patient.id) {
    throw new Error('Patient requires an id to be persisted');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const givenName =
    patient.name?.[0]?.given?.[0] || patient.name?.[0]?.text || 'Unknown';
  const familyName = patient.name?.[0]?.family || null;
  const gender = patient.gender || null;
  const birthDate = patient.birthDate || null;
  const patientId = patient.id;

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
      patientId,
      givenName,
      familyName,
      gender,
      birthDate,
      JSON.stringify(patient),
      now,
      now,
    ]
  );
}

/**
 * Retrieves all stored Patient records from SQLite.
 */
export async function fetchAllPatients(): Promise<Patient[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string }>(
    `SELECT fhir_json FROM patients ORDER BY created_at ASC, id ASC;`
  );
  return rows.map((r) => JSON.parse(r.fhir_json));
}

/**
 * Retrieves a Patient record by ID.
 */
export async function fetchPatientById(id: string): Promise<Patient | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string }>(
    `SELECT fhir_json FROM patients WHERE id = ?;`,
    [id]
  );
  return row ? JSON.parse(row.fhir_json) : null;
}

/**
 * Deletes a Patient record by ID. Also removes associated records via cascade.
 */
export async function deletePatientRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM patients WHERE id = ?;`, [id]);
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
}
