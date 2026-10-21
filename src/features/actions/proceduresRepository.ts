import type { Procedure } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { getProcedureDate, getProcedureRequestId } from './procedureDays';

export const VALID_PROCEDURE_STATUSES: Procedure['status'][] = [
  'preparation',
  'in-progress',
  'not-done',
  'on-hold',
  'stopped',
  'completed',
  'entered-in-error',
  'unknown',
];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function withLastUpdated(json: string, updatedAt: string): Procedure {
  const procedure: Procedure = JSON.parse(json);
  if (!procedure.meta?.lastUpdated && updatedAt) {
    procedure.meta = { ...procedure.meta, lastUpdated: updatedAt };
  }
  return procedure;
}

/**
 * Persists a FHIR R5 Procedure (a log of a scheduled service request) in
 * SQLite. The JSON is canonical; columns are projections of it.
 */
export async function insertProcedureRecord(
  procedure: Procedure,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (!procedure.id) {
    throw new Error('Procedure requires an id to be persisted');
  }
  if (procedure.resourceType !== 'Procedure') {
    throw new Error('Resource must have resourceType Procedure');
  }
  if (!VALID_PROCEDURE_STATUSES.includes(procedure.status)) {
    throw new Error(`Invalid Procedure status: ${procedure.status}`);
  }
  const subjectRef = procedure.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('Procedure subject must match its patient');
  }
  const occurrenceDate = getProcedureDate(procedure);
  if (!occurrenceDate || !DATE_ONLY.test(occurrenceDate)) {
    throw new Error('Procedure requires an occurrence date');
  }
  const requestId = getProcedureRequestId(procedure);
  if (!requestId) {
    throw new Error('Procedure must be based on a ServiceRequest');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = procedure.meta?.lastUpdated || now;
  const stored: Procedure = {
    ...procedure,
    meta: { ...procedure.meta, lastUpdated: incomingTimestamp },
    subject: { ...procedure.subject, reference: `Patient/${patientId}` },
  };
  const id = procedure.id;

  let didUpdate = false;
  const persist = async () => {
    const request = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM service_requests WHERE id = ?;',
      [requestId]
    );
    if (!request || request.patient_id !== patientId) {
      throw new Error(
        'Procedure must be based on a service request for the same patient'
      );
    }
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM procedures WHERE id = ?;',
      [id]
    );
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update Procedure ${id}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    await db.runAsync(
      `INSERT INTO procedures (
         id, patient_id, service_request_id, status, occurrence_date,
         fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         service_request_id = excluded.service_request_id,
         status = excluded.status,
         occurrence_date = excluded.occurrence_date,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        id,
        patientId,
        requestId,
        procedure.status,
        occurrenceDate,
        JSON.stringify(stored),
        now,
        incomingTimestamp,
      ]
    );
    didUpdate = true;
  };

  if (withinTransaction) {
    await persist();
  } else {
    await db.withTransactionAsync(persist);
  }
  if (didUpdate && !withinTransaction) {
    notifyDatabaseChanged(['procedures']);
  }
}

export async function fetchProcedureById(
  id: string,
  patientId: string
): Promise<Procedure | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    'SELECT fhir_json, updated_at FROM procedures WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  return row ? withLastUpdated(row.fhir_json, row.updated_at) : null;
}

/** The patient's procedure logs up to `to` (inclusive), oldest first. */
export async function fetchProceduresUpTo(
  patientId: string,
  to: string
): Promise<Procedure[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM procedures
     WHERE patient_id = ? AND occurrence_date <= ?
     ORDER BY occurrence_date, created_at;`,
    [patientId, to]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** A service request's logs, oldest first. */
export async function fetchProceduresByServiceRequestId(
  serviceRequestId: string,
  patientId: string
): Promise<Procedure[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM procedures
     WHERE service_request_id = ? AND patient_id = ?
     ORDER BY occurrence_date, created_at;`,
    [serviceRequestId, patientId]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** Every Procedure (optionally for one patient), for backups. */
export async function fetchAllProcedureRecords(
  patientId?: string
): Promise<{ procedure: Procedure; patientId: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, patient_id, updated_at FROM procedures
     ${patientId ? 'WHERE patient_id = ?' : ''}
     ORDER BY occurrence_date, created_at;`,
    patientId ? [patientId] : []
  );
  return rows.map((r) => ({
    procedure: withLastUpdated(r.fhir_json, r.updated_at),
    patientId: r.patient_id,
  }));
}

export async function deleteProcedureRecord(
  id: string,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'DELETE FROM procedures WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  if (result.changes && !withinTransaction)
    notifyDatabaseChanged(['procedures']);
}
