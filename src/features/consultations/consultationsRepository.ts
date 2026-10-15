import type { Encounter, MedicationRequest, ServiceRequest } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import {
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getConsultationBasedOnIds,
} from '@/src/utils/fhirUtils';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { assertOrganizationReferences } from '@/src/features/organizations/organizationsRepository';

/**
 * Persists an Encounter (Consultation) record using SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertConsultationRecord(
  consultation: Encounter,
  patientId: string = DEFAULT_PATIENT_ID,
  withinTransaction: boolean = false
): Promise<void> {
  if (!consultation.id) {
    throw new Error('Consultation requires an id to be persisted');
  }

  if (
    consultation.resourceType !== 'Encounter' ||
    ![
      'planned',
      'in-progress',
      'on-hold',
      'discharged',
      'completed',
      'cancelled',
      'discontinued',
      'entered-in-error',
      'unknown',
    ].includes(consultation.status)
  ) {
    throw new Error('Encounter requires a valid FHIR R5 status');
  }
  for (const date of [
    consultation.actualPeriod?.start,
    consultation.actualPeriod?.end,
    consultation.plannedStartDate,
    consultation.plannedEndDate,
  ]) {
    if (date?.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(date))
      throw new Error('Encounter date-time requires a timezone offset');
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
  const conditionIds = getConsultationConditionIds(consultation);
  if (consultation.subject?.reference !== `Patient/${patientId}`) {
    throw new Error('Encounter subject must match its patient');
  }
  const status = consultation.status || 'completed';
  const consId = consultation.id;

  let didUpdate = false;
  const persist = async () => {
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

    for (const conditionId of new Set([
      ...conditionIds,
      ...getConsultationReasonConditionIds(consultation),
    ])) {
      const condition = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM conditions WHERE id = ? AND patient_id = ?;',
        [conditionId, patientId]
      );
      if (!condition)
        throw new Error(
          'Diagnosis must reference an existing condition belonging to the same patient'
        );
    }

    await assertOrganizationReferences(
      [consultation.serviceProvider?.reference],
      patientId
    );

    // A referenced ServiceRequest must belong to the same patient. One not
    // stored yet is tolerated, so restores and sync can apply in any order.
    for (const requestId of getConsultationBasedOnIds(consultation)) {
      const request = await db.getFirstAsync<{ patient_id: string }>(
        'SELECT patient_id FROM service_requests WHERE id = ?;',
        [requestId]
      );
      if (request && request.patient_id !== patientId)
        throw new Error(
          'Encounter basedOn must reference a service request for the same patient'
        );
    }

    await db.runAsync(
      `INSERT INTO consultations (id, patient_id, date, doctor_name, service_type, title, notes, status, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
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
    await db.runAsync(
      'DELETE FROM consultation_conditions WHERE consultation_id = ?;',
      [consId]
    );
    for (const conditionId of conditionIds) {
      await db.runAsync(
        'INSERT INTO consultation_conditions (consultation_id, condition_id) VALUES (?, ?);',
        [consId, conditionId]
      );
    }
    didUpdate = true;
  };
  if (withinTransaction) await persist();
  else await db.withTransactionAsync(persist);

  if (didUpdate && !withinTransaction) {
    notifyDatabaseChanged(['consultations', 'consultation_conditions']);
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
    `SELECT c.fhir_json, c.updated_at FROM consultations c WHERE c.id IN (SELECT consultation_id FROM consultation_conditions WHERE condition_id = ?) OR EXISTS (SELECT 1 FROM json_each(c.fhir_json, '$.reason') r, json_each(r.value, '$.value') v WHERE json_extract(v.value, '$.reference.reference') = ?) ORDER BY c.date DESC, c.created_at DESC, c.id DESC;`,
    [conditionId, `Condition/${conditionId}`]
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
  id: string,
  patientId?: string
): Promise<Encounter | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM consultations WHERE id = ? AND (? IS NULL OR patient_id = ?);`,
    [id, patientId ?? null, patientId ?? null]
  );
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
  await db.withTransactionAsync(async () => {
    // Retain independent requests and clear their originating encounter in
    // both FHIR and SQL. Failures abort the whole deletion so the projection
    // never diverges from the canonical resource.
    const now = new Date().toISOString();
    for (const table of ['medication_requests', 'service_requests']) {
      const originating = await db.getAllAsync<{
        id: string;
        fhir_json: string;
      }>(`SELECT id, fhir_json FROM ${table} WHERE consultation_id = ?;`, [id]);
      for (const row of originating) {
        const req: MedicationRequest | ServiceRequest = JSON.parse(
          row.fhir_json
        );
        delete req.encounter;
        req.meta = { ...req.meta, lastUpdated: now };
        await db.runAsync(
          `UPDATE ${table}
           SET consultation_id = NULL,
               fhir_json = ?,
               updated_at = ?
           WHERE id = ?;`,
          [JSON.stringify(req), now, row.id]
        );
      }
    }

    // The Composition goes with it (ON DELETE CASCADE).
    await db.runAsync(`DELETE FROM consultations WHERE id = ?;`, [id]);
  });
  notifyDatabaseChanged([
    'consultations',
    'consultation_conditions',
    'clinical_documents',
    'medication_requests',
    'service_requests',
  ]);
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
