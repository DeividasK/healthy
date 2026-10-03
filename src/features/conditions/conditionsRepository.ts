import { Platform } from 'react-native';
import type { Condition } from 'fhir/r5';
import { initializeDatabase, getNativeDb } from '../../database/db';
import {
  insertConditionWeb,
  fetchAllConditionsWeb,
  fetchConditionByIdWeb,
  deleteConditionWeb,
} from '../../database/indexedDb';
import { getConditionTitle, getConditionNotes } from '../../utils/fhirUtils';

/**
 * Persists a Condition record.
 */
export async function insertConditionRecord(
  condition: Condition
): Promise<void> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await insertConditionWeb(condition);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
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

    const condId = condition.id || '';

    await nativeDb.runAsync(
      `INSERT INTO conditions (id, clinical_status, verification_status, onset_date, title, severity, body_site, abatement_date, description, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
}

/**
 * Retrieves all stored Condition records.
 */
export async function fetchAllConditionRecords(): Promise<Condition[]> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchAllConditionsWeb();
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    const rows = await nativeDb.getAllAsync(
      `SELECT * FROM conditions ORDER BY onset_date DESC, created_at DESC, id DESC;`
    );
    return rows.map((r: any) => JSON.parse(r.fhir_json));
  }

  return [];
}

/**
 * Retrieves a Condition record by its ID.
 */
export async function fetchConditionById(
  id: string
): Promise<Condition | null> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    return await fetchConditionByIdWeb(id);
  }

  const all = await fetchAllConditionRecords();
  return all.find((e) => e.id === id) || null;
}

/**
 * Deletes a Condition record by its ID.
 */
export async function deleteConditionRecord(id: string): Promise<void> {
  await initializeDatabase();

  if (Platform.OS === 'web') {
    await deleteConditionWeb(id);
    return;
  }

  const nativeDb = getNativeDb();
  if (nativeDb) {
    await nativeDb.runAsync(`DELETE FROM conditions WHERE id = ?;`, [id]);
  }
}
