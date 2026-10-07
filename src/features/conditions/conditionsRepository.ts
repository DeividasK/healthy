import type { Condition } from 'fhir/r5';
import { getDb } from '../../database/db';
import { getConditionTitle, getConditionNotes } from '../../utils/fhirUtils';
import { DEFAULT_PATIENT_ID } from '../profile/patientRepository';

/**
 * Persists a Condition record using SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertConditionRecord(
  condition: Condition,
  patientId: string = DEFAULT_PATIENT_ID
): Promise<void> {
  if (!condition.id) {
    throw new Error('Condition requires an id to be persisted');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const onsetDate = condition.onsetDateTime || now.split('T')[0];
  const title = getConditionTitle(condition);
  const notesText = getConditionNotes(condition);
  const clinicalStatus =
    condition.clinicalStatus?.coding?.[0]?.code || 'active';
  const verificationStatus =
    condition.verificationStatus?.coding?.[0]?.code || 'unconfirmed';
  const severity = condition.severity?.coding?.[0]?.code || null;
  const bodySite = condition.bodySite?.[0]?.text || null;
  const abatementDate = condition.abatementDateTime || null;
  const condId = condition.id;

  await db.runAsync(
    `INSERT INTO conditions (id, patient_id, clinical_status, verification_status, onset_date, title, severity, body_site, abatement_date, description, fhir_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       clinical_status = excluded.clinical_status,
       verification_status = excluded.verification_status,
       onset_date = excluded.onset_date,
       title = excluded.title,
       severity = excluded.severity,
       body_site = excluded.body_site,
       abatement_date = excluded.abatement_date,
       description = excluded.description,
       fhir_json = excluded.fhir_json,
       updated_at = excluded.updated_at;`,
    [
      condId,
      patientId,
      clinicalStatus,
      verificationStatus,
      onsetDate,
      title,
      severity,
      bodySite,
      abatementDate,
      notesText,
      JSON.stringify(condition),
      now,
      now,
    ]
  );
}

/**
 * Retrieves all stored Condition records from SQLite.
 * Filters by patientId if provided.
 */
export async function fetchAllConditionRecords(
  patientId?: string
): Promise<Condition[]> {
  const db = await getDb();
  let rows: { fhir_json: string }[] = [];
  if (patientId) {
    rows = await db.getAllAsync<{ fhir_json: string }>(
      `SELECT fhir_json FROM conditions WHERE patient_id = ? ORDER BY onset_date DESC, created_at DESC, id DESC;`,
      [patientId]
    );
  } else {
    rows = await db.getAllAsync<{ fhir_json: string }>(
      `SELECT fhir_json FROM conditions ORDER BY onset_date DESC, created_at DESC, id DESC;`
    );
  }
  return rows.map((r) => JSON.parse(r.fhir_json));
}

/**
 * Retrieves a Condition record by its ID from SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function fetchConditionById(
  id: string
): Promise<Condition | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string }>(
    `SELECT fhir_json FROM conditions WHERE id = ?;`,
    [id]
  );
  return row ? JSON.parse(row.fhir_json) : null;
}

/**
 * Deletes a Condition record by its ID from SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function deleteConditionRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM conditions WHERE id = ?;`, [id]);
}
