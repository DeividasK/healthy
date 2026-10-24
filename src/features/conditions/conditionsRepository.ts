import type {
  Condition,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';
import { getDb } from '@/src/database/db';
import {
  getConditionTitle,
  getConditionNotes,
  getConsultationConditionIds,
  withoutEncounterReference,
  withoutReasonReference,
} from '@/src/utils/fhirUtils';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';

/**
 * Persists a Condition record using SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertConditionRecord(
  condition: Condition,
  patientId: string = DEFAULT_PATIENT_ID,
  withinTransaction: boolean = false
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
  const persist = async () => {
    const existing = await db.getFirstAsync<{
      patient_id: string;
      updated_at: string;
    }>(`SELECT patient_id, updated_at FROM conditions WHERE id = ?;`, [condId]);
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update condition ${condId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
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
  };
  if (withinTransaction) await persist();
  else await db.withTransactionAsync(persist);

  if (didUpdate && !withinTransaction) {
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
 * The patient's conditions with the lab results linked to them: a result
 * based on a service request whose reason is the condition. Ordered like
 * the condition list.
 */
export async function fetchConditionLabResultLinks(
  patientId: string
): Promise<{ condition: Condition; reportIds: string[] }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    condition_id: string;
    report_id: string;
  }>(
    `SELECT DISTINCT conditions.id AS condition_id, diagnostic_reports.id AS report_id
     FROM diagnostic_reports
     JOIN json_each(diagnostic_reports.fhir_json, '$.basedOn') AS based_on
     JOIN service_requests
       ON json_extract(based_on.value, '$.reference') = 'ServiceRequest/' || service_requests.id
       AND service_requests.patient_id = diagnostic_reports.patient_id
     JOIN json_each(service_requests.fhir_json, '$.reason') AS reason
     JOIN conditions
       ON json_extract(reason.value, '$.reference.reference') = 'Condition/' || conditions.id
       AND conditions.patient_id = diagnostic_reports.patient_id
     WHERE diagnostic_reports.patient_id = ?;`,
    [patientId]
  );
  const reportIds = new Map<string, string[]>();
  for (const row of rows)
    reportIds.set(row.condition_id, [
      ...(reportIds.get(row.condition_id) || []),
      row.report_id,
    ]);
  return (await fetchAllConditionRecords(patientId)).flatMap((condition) =>
    condition.id && reportIds.has(condition.id)
      ? [{ condition, reportIds: reportIds.get(condition.id)! }]
      : []
  );
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
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: string; fhir_json: string }>(
      'SELECT id, fhir_json FROM consultations WHERE patient_id = (SELECT patient_id FROM conditions WHERE id = ?);',
      [id]
    );
    const now = new Date().toISOString();
    for (const row of rows) {
      const encounter: Encounter = JSON.parse(row.fhir_json);
      const reference = `Condition/${id}`;
      const hasReason = encounter.reason?.some((reason) =>
        reason.value?.some((value) => value.reference?.reference === reference)
      );
      if (!getConsultationConditionIds(encounter).includes(id) && !hasReason)
        continue;
      const updated = withoutEncounterReference(encounter, reference);
      updated.meta = { ...encounter.meta, lastUpdated: now };
      await db.runAsync(
        'UPDATE consultations SET fhir_json = ?, updated_at = ? WHERE id = ?;',
        [JSON.stringify(updated), now, row.id]
      );
    }
    // Requests keep their indication wording; only the Condition link goes.
    for (const table of ['medication_requests', 'service_requests']) {
      const requestRows = await db.getAllAsync<{
        id: string;
        fhir_json: string;
      }>(
        `SELECT id, fhir_json FROM ${table}
         WHERE patient_id = (SELECT patient_id FROM conditions WHERE id = ?)
         AND fhir_json LIKE ?;`,
        [id, `%Condition/${id}%`]
      );
      for (const row of requestRows) {
        const request: MedicationRequest | ServiceRequest = JSON.parse(
          row.fhir_json
        );
        const updated = withoutReasonReference(request, `Condition/${id}`);
        if (updated === request) continue;
        updated.meta = { ...request.meta, lastUpdated: now };
        await db.runAsync(
          `UPDATE ${table} SET fhir_json = ?, updated_at = ? WHERE id = ?;`,
          [JSON.stringify(updated), now, row.id]
        );
      }
    }
    await db.runAsync('DELETE FROM conditions WHERE id = ?;', [id]);
  });
  notifyDatabaseChanged([
    'conditions',
    'consultations',
    'consultation_conditions',
    'medication_requests',
    'service_requests',
  ]);
}
