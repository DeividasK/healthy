import type { MedicationAdministration } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  getAdministrationDate,
  getAdministrationRequestId,
} from './actionDays';

export const VALID_MEDICATION_ADMINISTRATION_STATUSES: MedicationAdministration['status'][] =
  [
    'in-progress',
    'not-done',
    'on-hold',
    'completed',
    'entered-in-error',
    'stopped',
    'unknown',
  ];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function withLastUpdated(
  json: string,
  updatedAt: string
): MedicationAdministration {
  const administration: MedicationAdministration = JSON.parse(json);
  if (!administration.meta?.lastUpdated && updatedAt) {
    administration.meta = { ...administration.meta, lastUpdated: updatedAt };
  }
  return administration;
}

/**
 * Persists a FHIR R5 MedicationAdministration (a treatment log) in SQLite.
 * The JSON is canonical; columns are projections of it.
 */
export async function insertMedicationAdministrationRecord(
  administration: MedicationAdministration,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  if (!administration.id) {
    throw new Error('MedicationAdministration requires an id to be persisted');
  }
  if (administration.resourceType !== 'MedicationAdministration') {
    throw new Error('Resource must have resourceType MedicationAdministration');
  }
  if (
    !VALID_MEDICATION_ADMINISTRATION_STATUSES.includes(administration.status)
  ) {
    throw new Error(
      `Invalid MedicationAdministration status: ${administration.status}`
    );
  }
  const subjectRef = administration.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('MedicationAdministration subject must match its patient');
  }
  const occurrenceDate = getAdministrationDate(administration);
  if (!occurrenceDate || !DATE_ONLY.test(occurrenceDate)) {
    throw new Error('MedicationAdministration requires an occurrence date');
  }
  const requestId = getAdministrationRequestId(administration);
  if (!requestId) {
    throw new Error(
      'MedicationAdministration request must reference a MedicationRequest'
    );
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = administration.meta?.lastUpdated || now;
  const administrationWithMeta: MedicationAdministration = {
    ...administration,
    meta: { ...administration.meta, lastUpdated: incomingTimestamp },
    subject: { ...administration.subject, reference: `Patient/${patientId}` },
  };
  const id = administration.id;

  let didUpdate = false;
  const persist = async () => {
    const request = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM medication_requests WHERE id = ?;',
      [requestId]
    );
    if (!request || request.patient_id !== patientId) {
      throw new Error(
        'MedicationAdministration must reference a treatment for the same patient'
      );
    }
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM medication_administrations WHERE id = ?;',
      [id]
    );
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update MedicationAdministration ${id}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    await db.runAsync(
      `INSERT INTO medication_administrations (
         id, patient_id, medication_request_id, status, occurrence_date,
         fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         medication_request_id = excluded.medication_request_id,
         status = excluded.status,
         occurrence_date = excluded.occurrence_date,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        id,
        patientId,
        requestId,
        administration.status,
        occurrenceDate,
        JSON.stringify(administrationWithMeta),
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
    notifyDatabaseChanged(['medication_administrations']);
  }
}

export async function fetchMedicationAdministrationById(
  id: string,
  patientId: string
): Promise<MedicationAdministration | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM medication_administrations
     WHERE id = ? AND patient_id = ?;`,
    [id, patientId]
  );
  return row ? withLastUpdated(row.fhir_json, row.updated_at) : null;
}

/** The patient's treatment logs on days from `from` to `to` (inclusive). */
export async function fetchMedicationAdministrationsInRange(
  patientId: string,
  from: string,
  to: string
): Promise<MedicationAdministration[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM medication_administrations
     WHERE patient_id = ? AND occurrence_date BETWEEN ? AND ?
     ORDER BY occurrence_date, created_at;`,
    [patientId, from, to]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** Every MedicationAdministration (optionally for one patient), for backups. */
export async function fetchAllMedicationAdministrationRecords(
  patientId?: string
): Promise<{ administration: MedicationAdministration; patientId: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, patient_id, updated_at FROM medication_administrations
     ${patientId ? 'WHERE patient_id = ?' : ''}
     ORDER BY occurrence_date, created_at;`,
    patientId ? [patientId] : []
  );
  return rows.map((r) => ({
    administration: withLastUpdated(r.fhir_json, r.updated_at),
    patientId: r.patient_id,
  }));
}

export async function deleteMedicationAdministrationRecord(
  id: string,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'DELETE FROM medication_administrations WHERE id = ? AND patient_id = ?;',
    [id, patientId]
  );
  if (result.changes && !withinTransaction)
    notifyDatabaseChanged(['medication_administrations']);
}

/** The first day a treatment was logged, or null before any log. */
export async function fetchFirstAdministrationDate(
  patientId: string,
  medicationRequestId: string
): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ first: string | null }>(
    `SELECT MIN(occurrence_date) AS first FROM medication_administrations
     WHERE patient_id = ? AND medication_request_id = ?;`,
    [patientId, medicationRequestId]
  );
  return row?.first ?? null;
}
