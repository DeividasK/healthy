import type { Condition } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { getConditionTitle, getConditionNotes } from '@/src/utils/fhirUtils';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { isExistingNewerOrEqual } from '@/src/utils/dateUtils';

/**
 * Persists a Condition record using SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertConditionRecord(
  condition: Condition,
  patientId: string = DEFAULT_PATIENT_ID,
  isRemoteSync: boolean = false
): Promise<void> {
  if (!condition.id) {
    throw new Error('Condition requires an id to be persisted');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = condition.meta?.lastUpdated || now;
  const conditionWithMeta: Condition = {
    ...condition,
    meta: {
      ...condition.meta,
      lastUpdated: incomingTimestamp,
    },
  };
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

  let didUpdate = false;
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{
      patient_id: string;
      updated_at: string;
    }>(`SELECT patient_id, updated_at FROM conditions WHERE id = ?;`, [condId]);
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update condition ${condId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    // Last-write-wins: during remote sync, if existing record is newer than or same as incoming change, keep existing
    if (
      isRemoteSync &&
      existing?.updated_at &&
      isExistingNewerOrEqual(existing.updated_at, incomingTimestamp)
    ) {
      return;
    }

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
        JSON.stringify(conditionWithMeta),
        now,
        incomingTimestamp,
      ]
    );
    didUpdate = true;
  });

  if (didUpdate) {
    notifyDatabaseChanged(['conditions']);
  }
}

/**
 * Retrieves all stored Condition records from SQLite.
 * Filters by patientId if provided.
 */
export async function fetchAllConditionRecords(
  patientId?: string
): Promise<Condition[]> {
  const db = await getDb();
  let rows: { fhir_json: string; updated_at: string }[] = [];
  if (patientId) {
    rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
      `SELECT fhir_json, updated_at FROM conditions WHERE patient_id = ? ORDER BY onset_date DESC, created_at DESC, id DESC;`,
      [patientId]
    );
  } else {
    rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
      `SELECT fhir_json, updated_at FROM conditions ORDER BY onset_date DESC, created_at DESC, id DESC;`
    );
  }
  return rows.map((r) => {
    const cond: Condition = JSON.parse(r.fhir_json);
    if (!cond.meta?.lastUpdated && r.updated_at) {
      cond.meta = { ...cond.meta, lastUpdated: r.updated_at };
    }
    return cond;
  });
}

/**
 * Retrieves a Condition record by its ID from SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function fetchConditionById(
  id: string
): Promise<Condition | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM conditions WHERE id = ?;`,
    [id]
  );
  if (!row) return null;
  const cond: Condition = JSON.parse(row.fhir_json);
  if (!cond.meta?.lastUpdated && row.updated_at) {
    cond.meta = { ...cond.meta, lastUpdated: row.updated_at };
  }
  return cond;
}

/**
 * Deletes a Condition record by its ID from SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function deleteConditionRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM conditions WHERE id = ?;`, [id]);
  notifyDatabaseChanged(['conditions']);
}
