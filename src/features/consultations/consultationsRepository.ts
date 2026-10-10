import type { Encounter } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import {
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionId,
} from '@/src/utils/fhirUtils';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { isExistingNewerOrEqual } from '@/src/utils/dateUtils';
import {
  recordPendingConsultationDeletion,
  clearPendingConsultationDeletions,
} from '@/src/services/syncDeletions';

/**
 * Persists an Encounter (Consultation) record using SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertConsultationRecord(
  consultation: Encounter,
  patientId: string = DEFAULT_PATIENT_ID,
  explicitConditionId?: string | null,
  isRemoteSync: boolean = false
): Promise<void> {
  if (!consultation.id) {
    throw new Error('Consultation requires an id to be persisted');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = consultation.meta?.lastUpdated || now;
  const consultationWithMeta: Encounter = {
    ...consultation,
    meta: {
      ...consultation.meta,
      lastUpdated: incomingTimestamp,
    },
  };

  const date =
    consultation.actualPeriod?.start ||
    consultation.plannedStartDate ||
    now.split('T')[0];
  const title = getConsultationTitle(consultation);
  const doctorName = getConsultationDoctor(consultation);
  const serviceType = getConsultationServiceType(consultation);
  const notesText = getConsultationNotes(consultation);
  const resolvedConditionId =
    explicitConditionId !== undefined
      ? explicitConditionId
      : getConsultationConditionId(consultation);
  const status = consultation.status || 'completed';
  const consId = consultation.id;

  let didUpdate = false;
  await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync<{
      patient_id: string;
      updated_at: string;
    }>(`SELECT patient_id, updated_at FROM consultations WHERE id = ?;`, [
      consId,
    ]);
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update consultation ${consId}: belongs to patient ${existing.patient_id}, not ${patientId}`
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

    let validConditionId: string | null = null;
    if (resolvedConditionId) {
      const condRow = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM conditions WHERE id = ? AND patient_id = ?;`,
        [resolvedConditionId, patientId]
      );
      if (condRow) {
        validConditionId = resolvedConditionId;
      }
    }

    await db.runAsync(
      `INSERT INTO consultations (id, patient_id, condition_id, date, doctor_name, service_type, title, notes, status, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         condition_id = excluded.condition_id,
         date = excluded.date,
         doctor_name = excluded.doctor_name,
         service_type = excluded.service_type,
         title = excluded.title,
         notes = excluded.notes,
         status = excluded.status,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        consId,
        patientId,
        validConditionId ?? null,
        date,
        doctorName ?? null,
        serviceType ?? null,
        title,
        notesText ?? null,
        status,
        JSON.stringify(consultationWithMeta),
        now,
        incomingTimestamp,
      ]
    );
    didUpdate = true;
  });

  if (didUpdate) {
    await clearPendingConsultationDeletions([consId]);
    notifyDatabaseChanged(['consultations']);
  }
}

/**
 * Retrieves all stored Consultation records from SQLite.
 * Filters by patientId if provided.
 */
export async function fetchAllConsultationRecords(
  patientId?: string
): Promise<Encounter[]> {
  const db = await getDb();
  let rows: { fhir_json: string; updated_at: string }[] = [];
  if (patientId) {
    rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
      `SELECT fhir_json, updated_at FROM consultations WHERE patient_id = ? ORDER BY date DESC, created_at DESC, id DESC;`,
      [patientId]
    );
  } else {
    rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
      `SELECT fhir_json, updated_at FROM consultations ORDER BY date DESC, created_at DESC, id DESC;`
    );
  }
  return rows.map((r) => {
    const enc: Encounter = JSON.parse(r.fhir_json);
    if (!enc.meta?.lastUpdated && r.updated_at) {
      enc.meta = { ...enc.meta, lastUpdated: r.updated_at };
    }
    return enc;
  });
}

/**
 * Retrieves Consultation records associated with a specific Condition.
 */
export async function fetchConsultationsByConditionId(
  conditionId: string
): Promise<Encounter[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM consultations WHERE condition_id = ? ORDER BY date DESC, created_at DESC, id DESC;`,
    [conditionId]
  );
  return rows.map((r) => {
    const enc: Encounter = JSON.parse(r.fhir_json);
    if (!enc.meta?.lastUpdated && r.updated_at) {
      enc.meta = { ...enc.meta, lastUpdated: r.updated_at };
    }
    return enc;
  });
}

/**
 * Retrieves a single Consultation record by ID from SQLite.
 */
export async function fetchConsultationById(
  id: string
): Promise<Encounter | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    updated_at: string;
  }>(`SELECT fhir_json, updated_at FROM consultations WHERE id = ?;`, [id]);
  if (!row) return null;
  const enc: Encounter = JSON.parse(row.fhir_json);
  if (!enc.meta?.lastUpdated && row.updated_at) {
    enc.meta = { ...enc.meta, lastUpdated: row.updated_at };
  }
  return enc;
}

/**
 * Deletes a Consultation record by its ID from SQLite.
 */
export async function deleteConsultationRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM consultations WHERE id = ?;`, [id]);
  await recordPendingConsultationDeletion(id);
  notifyDatabaseChanged(['consultations']);
}

/**
 * Fetches distinct non-empty doctor names previously saved for the given patient (or all).
 */
export async function fetchDistinctDoctorNames(
  patientId?: string
): Promise<string[]> {
  const db = await getDb();
  let rows: { doctor_name: string }[] = [];
  if (patientId) {
    rows = await db.getAllAsync<{ doctor_name: string }>(
      `SELECT DISTINCT doctor_name FROM consultations WHERE patient_id = ? AND doctor_name IS NOT NULL AND TRIM(doctor_name) != '' ORDER BY doctor_name ASC;`,
      [patientId]
    );
  } else {
    rows = await db.getAllAsync<{ doctor_name: string }>(
      `SELECT DISTINCT doctor_name FROM consultations WHERE doctor_name IS NOT NULL AND TRIM(doctor_name) != '' ORDER BY doctor_name ASC;`
    );
  }
  return rows.map((r) => r.doctor_name);
}

/**
 * Fetches distinct non-empty service types / specialties previously saved for the given patient (or all).
 */
export async function fetchDistinctServiceTypes(
  patientId?: string
): Promise<string[]> {
  const db = await getDb();
  let rows: { service_type: string }[] = [];
  if (patientId) {
    rows = await db.getAllAsync<{ service_type: string }>(
      `SELECT DISTINCT service_type FROM consultations WHERE patient_id = ? AND service_type IS NOT NULL AND TRIM(service_type) != '' ORDER BY service_type ASC;`,
      [patientId]
    );
  } else {
    rows = await db.getAllAsync<{ service_type: string }>(
      `SELECT DISTINCT service_type FROM consultations WHERE service_type IS NOT NULL AND TRIM(service_type) != '' ORDER BY service_type ASC;`
    );
  }
  return rows.map((r) => r.service_type);
}
