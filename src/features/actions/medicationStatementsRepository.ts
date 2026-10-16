import type { MedicationStatement } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  getAdherenceCode,
  getStatementDates,
  getStatementRequestId,
} from './treatmentUsage';

const VALID_STATUSES: MedicationStatement['status'][] = [
  'recorded',
  'entered-in-error',
  'draft',
];

function withLastUpdated(json: string, updatedAt: string): MedicationStatement {
  const statement: MedicationStatement = JSON.parse(json);
  if (!statement.meta?.lastUpdated && updatedAt) {
    statement.meta = { ...statement.meta, lastUpdated: updatedAt };
  }
  return statement;
}

/**
 * Persists a FHIR R5 MedicationStatement (a period of using a treatment) in
 * SQLite. The JSON is canonical; columns are projections of it.
 */
export async function insertMedicationStatementRecord(
  statement: MedicationStatement,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (!statement.id) {
    throw new Error('MedicationStatement requires an id to be persisted');
  }
  if (statement.resourceType !== 'MedicationStatement') {
    throw new Error('Resource must have resourceType MedicationStatement');
  }
  if (!VALID_STATUSES.includes(statement.status)) {
    throw new Error(`Invalid MedicationStatement status: ${statement.status}`);
  }
  const subjectRef = statement.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('MedicationStatement subject must match its patient');
  }
  const { start, end } = getStatementDates(statement);
  if (!start) throw new Error('MedicationStatement requires a start date');
  if (end && end < start) {
    throw new Error('MedicationStatement period must not end before it starts');
  }
  const requestId = getStatementRequestId(statement);
  if (!requestId) {
    throw new Error(
      'MedicationStatement must be derived from a MedicationRequest'
    );
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = statement.meta?.lastUpdated || now;
  const statementWithMeta: MedicationStatement = {
    ...statement,
    meta: { ...statement.meta, lastUpdated: incomingTimestamp },
    subject: { ...statement.subject, reference: `Patient/${patientId}` },
  };
  const id = statement.id;

  const persist = async () => {
    const request = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM medication_requests WHERE id = ?;',
      [requestId]
    );
    if (!request || request.patient_id !== patientId) {
      throw new Error(
        'MedicationStatement must be derived from a treatment for the same patient'
      );
    }
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM medication_statements WHERE id = ?;',
      [id]
    );
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update MedicationStatement ${id}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }
    await db.runAsync(
      `INSERT INTO medication_statements (
         id, patient_id, medication_request_id, adherence_code, start_date,
         end_date, fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         medication_request_id = excluded.medication_request_id,
         adherence_code = excluded.adherence_code,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        id,
        patientId,
        requestId,
        getAdherenceCode(statement),
        start,
        end ?? null,
        JSON.stringify(statementWithMeta),
        now,
        incomingTimestamp,
      ]
    );
  };

  if (withinTransaction) {
    await persist();
  } else {
    await db.withTransactionAsync(persist);
    notifyDatabaseChanged(['medication_statements']);
  }
}

/** The patient's MedicationStatements, optionally for one treatment. */
export async function fetchMedicationStatements(
  patientId: string,
  medicationRequestId?: string
): Promise<MedicationStatement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM medication_statements
     WHERE patient_id = ? AND (? IS NULL OR medication_request_id = ?)
     ORDER BY start_date, created_at;`,
    [patientId, medicationRequestId ?? null, medicationRequestId ?? null]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** Every MedicationStatement (optionally for one patient), for backups. */
export async function fetchAllMedicationStatementRecords(
  patientId?: string
): Promise<{ statement: MedicationStatement; patientId: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, patient_id, updated_at FROM medication_statements
     ${patientId ? 'WHERE patient_id = ?' : ''}
     ORDER BY start_date, created_at;`,
    patientId ? [patientId] : []
  );
  return rows.map((r) => ({
    statement: withLastUpdated(r.fhir_json, r.updated_at),
    patientId: r.patient_id,
  }));
}

export async function deleteMedicationStatementRecord(
  id: string,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'DELETE FROM medication_statements WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  if (result.changes && !withinTransaction)
    notifyDatabaseChanged(['medication_statements']);
}
