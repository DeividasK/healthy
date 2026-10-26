import type { RequestOrchestration } from 'fhir/r5';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleTitle,
  withoutMember,
} from './bundleModel';

const VALID_STATUSES: RequestOrchestration['status'][] = [
  'draft',
  'active',
  'on-hold',
  'revoked',
  'completed',
  'entered-in-error',
  'unknown',
];

function parse(row: { fhir_json: string; updated_at: string }) {
  const bundle: RequestOrchestration = JSON.parse(row.fhir_json);
  if (!bundle.meta?.lastUpdated && row.updated_at)
    bundle.meta = { ...bundle.meta, lastUpdated: row.updated_at };
  return bundle;
}

/**
 * Persists a bundle (FHIR R5 RequestOrchestration) in SQLite. The JSON is
 * canonical; the title and status columns are projections of it. Treatments
 * and activities it references must belong to the same patient; one not
 * stored yet is tolerated, so restores and sync can apply in any order.
 */
export async function insertRequestOrchestrationRecord(
  bundle: RequestOrchestration,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (!bundle.id) {
    throw new Error('RequestOrchestration requires an id to be persisted');
  }
  if (bundle.resourceType !== 'RequestOrchestration') {
    throw new Error('Resource must have resourceType RequestOrchestration');
  }
  if (!VALID_STATUSES.includes(bundle.status)) {
    throw new Error(`Invalid RequestOrchestration status: ${bundle.status}`);
  }
  const subjectRef = bundle.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('RequestOrchestration subject must match its patient');
  }
  if (!bundle.action?.[0]?.title?.trim()) {
    throw new Error('A bundle requires a name');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = bundle.meta?.lastUpdated || now;
  const stored: RequestOrchestration = {
    ...bundle,
    meta: { ...bundle.meta, lastUpdated: incomingTimestamp },
    subject: { ...bundle.subject, reference: `Patient/${patientId}` },
  };
  const id = bundle.id;

  const persist = async () => {
    const members = [
      ...getBundleMemberIds(stored).map((memberId) => ({
        memberId,
        table: 'medication_requests',
      })),
      ...getBundleActivityIds(stored).map((memberId) => ({
        memberId,
        table: 'service_requests',
      })),
    ];
    for (const { memberId, table } of members) {
      const member = await db.getFirstAsync<{ patient_id: string }>(
        `SELECT patient_id FROM ${table} WHERE id = ?;`,
        [memberId]
      );
      if (member && member.patient_id !== patientId) {
        throw new Error(
          'A bundle must only reference treatments and activities for the same patient'
        );
      }
    }
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM request_orchestrations WHERE id = ?;',
      [id]
    );
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update RequestOrchestration ${id}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }
    await db.runAsync(
      `INSERT INTO request_orchestrations (
         id, patient_id, title, status, fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         title = excluded.title,
         status = excluded.status,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        id,
        patientId,
        getBundleTitle(stored),
        stored.status,
        JSON.stringify(stored),
        now,
        incomingTimestamp,
      ]
    );
  };

  if (withinTransaction) {
    await persist();
  } else {
    await db.withTransactionAsync(persist);
    notifyDatabaseChanged(['request_orchestrations']);
  }
}

export async function fetchRequestOrchestrationById(
  id: string,
  patientId: string
): Promise<RequestOrchestration | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    'SELECT fhir_json, updated_at FROM request_orchestrations WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  return row ? parse(row) : null;
}

/** A patient's bundles, oldest first: earlier bundles claim doses first. */
export async function fetchRequestOrchestrationsByPatientId(
  patientId: string
): Promise<RequestOrchestration[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM request_orchestrations
     WHERE patient_id = ?
     ORDER BY created_at, id;`,
    [patientId]
  );
  return rows.map(parse);
}

export async function fetchAllRequestOrchestrationRecords(): Promise<
  { bundle: RequestOrchestration; patientId: string }[]
> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    updated_at: string;
    patient_id: string;
  }>(
    'SELECT fhir_json, updated_at, patient_id FROM request_orchestrations ORDER BY created_at, id;'
  );
  return rows.map((row) => ({ bundle: parse(row), patientId: row.patient_id }));
}

export async function deleteRequestOrchestrationRecord(
  id: string,
  patientId: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM request_orchestrations WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  notifyDatabaseChanged(['request_orchestrations']);
}

/**
 * Removes a treatment or activity, e.g. `MedicationRequest/<id>`, from every
 * bundle of its patient, deleting bundles left with no members. Runs inside
 * the caller's transaction (e.g. deleting the treatment).
 */
export async function removeFromBundles(
  db: SQLiteDatabase,
  reference: string,
  patientId: string
): Promise<void> {
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM request_orchestrations
     WHERE patient_id = ? AND instr(fhir_json, ?) > 0;`,
    [patientId, `"${reference}"`]
  );
  const now = new Date().toISOString();
  for (const row of rows) {
    const bundle = parse(row);
    const next = withoutMember(bundle, reference);
    if (!next) {
      await db.runAsync('DELETE FROM request_orchestrations WHERE id = ?;', [
        bundle.id!,
      ]);
      continue;
    }
    await db.runAsync(
      'UPDATE request_orchestrations SET fhir_json = ?, updated_at = ? WHERE id = ?;',
      [
        JSON.stringify({ ...next, meta: { ...next.meta, lastUpdated: now } }),
        now,
        bundle.id!,
      ]
    );
  }
}
