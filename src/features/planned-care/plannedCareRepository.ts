import type { Encounter, ServiceRequest } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  getPlannedCareTitle,
  withConsultationBasedOn,
  getConsultationBasedOnIds,
} from '@/src/utils/fhirUtils';
import { removeEntryFromAllDocuments } from '@/src/features/consultations/consultationDocumentEntries';

export const VALID_SERVICE_REQUEST_STATUSES: ServiceRequest['status'][] = [
  'draft',
  'active',
  'on-hold',
  'revoked',
  'completed',
  'entered-in-error',
  'unknown',
];

export const VALID_SERVICE_REQUEST_INTENTS: ServiceRequest['intent'][] = [
  'proposal',
  'plan',
  'directive',
  'order',
  'original-order',
  'reflex-order',
  'filler-order',
  'instance-order',
  'option',
];

const hasTimeWithoutZone = (value?: string) =>
  Boolean(value?.includes('T') && !/(Z|[+-]\d{2}:\d{2})$/.test(value));

function withLastUpdated(json: string, updatedAt: string): ServiceRequest {
  const request: ServiceRequest = JSON.parse(json);
  if (!request.meta?.lastUpdated && updatedAt) {
    request.meta = { ...request.meta, lastUpdated: updatedAt };
  }
  return request;
}

/**
 * Persists a FHIR R5 ServiceRequest (planned investigation, procedure,
 * referral or follow-up) in SQLite. The JSON is canonical; columns are
 * projections of it.
 */
export async function insertServiceRequestRecord(
  request: ServiceRequest,
  patientId: string = DEFAULT_PATIENT_ID,
  withinTransaction: boolean = false
): Promise<void> {
  if (!request.id) {
    throw new Error('ServiceRequest requires an id to be persisted');
  }
  if (request.resourceType !== 'ServiceRequest') {
    throw new Error('Resource must have resourceType ServiceRequest');
  }
  if (!VALID_SERVICE_REQUEST_STATUSES.includes(request.status)) {
    throw new Error(`Invalid ServiceRequest status: ${request.status}`);
  }
  if (!VALID_SERVICE_REQUEST_INTENTS.includes(request.intent)) {
    throw new Error(`Invalid ServiceRequest intent: ${request.intent}`);
  }
  const subjectRef = request.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('ServiceRequest subject must match its patient');
  }
  if (
    hasTimeWithoutZone(request.authoredOn) ||
    hasTimeWithoutZone(request.occurrenceDateTime)
  ) {
    throw new Error('ServiceRequest date-times require a timezone offset');
  }

  const encounterRef = request.encounter?.reference;
  let consultationId: string | null = null;
  if (encounterRef) {
    if (!encounterRef.startsWith('Encounter/')) {
      throw new Error('ServiceRequest encounter must reference an Encounter');
    }
    consultationId = encounterRef.slice(10);
  }

  const displayLabel = getPlannedCareTitle(request);
  if (!displayLabel.trim()) {
    throw new Error('ServiceRequest requires a service description');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = request.meta?.lastUpdated || now;
  const requestWithMeta: ServiceRequest = {
    ...request,
    meta: { ...request.meta, lastUpdated: incomingTimestamp },
    subject: { ...request.subject, reference: `Patient/${patientId}` },
  };
  const reqId = request.id;
  const requisition = request.requisition;

  let didUpdate = false;
  const persist = async () => {
    for (const reason of requestWithMeta.reason || []) {
      const reference = reason.reference?.reference;
      if (!reference?.startsWith('Condition/')) continue;
      const condition = await db.getFirstAsync<{ patient_id: string }>(
        'SELECT patient_id FROM conditions WHERE id = ?;',
        [reference.slice(10)]
      );
      if (!condition || condition.patient_id !== patientId) {
        throw new Error(
          'Service request reason must reference a condition for the same patient'
        );
      }
    }
    if (consultationId) {
      const consultation = await db.getFirstAsync<{ patient_id: string }>(
        'SELECT patient_id FROM consultations WHERE id = ?;',
        [consultationId]
      );
      if (!consultation) {
        throw new Error(
          `Consultation ${consultationId} not found for ServiceRequest ${reqId}`
        );
      }
      if (consultation.patient_id !== patientId) {
        throw new Error(
          `Cannot link ServiceRequest for patient ${patientId} to consultation belonging to ${consultation.patient_id}`
        );
      }
    }

    const existing = await db.getFirstAsync<{ patient_id: string }>(
      'SELECT patient_id FROM service_requests WHERE id = ?;',
      [reqId]
    );
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update ServiceRequest ${reqId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    await db.runAsync(
      `INSERT INTO service_requests (
         id, patient_id, consultation_id, display_label, status, intent,
         category_code, authored_on, occurrence, requisition_system,
         requisition_value, fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         consultation_id = excluded.consultation_id,
         display_label = excluded.display_label,
         status = excluded.status,
         intent = excluded.intent,
         category_code = excluded.category_code,
         authored_on = excluded.authored_on,
         occurrence = excluded.occurrence,
         requisition_system = excluded.requisition_system,
         requisition_value = excluded.requisition_value,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        reqId,
        patientId,
        consultationId,
        displayLabel,
        request.status,
        request.intent,
        request.category?.[0]?.coding?.[0]?.code ?? null,
        request.authoredOn || now.split('T')[0],
        request.occurrenceDateTime ?? null,
        // Identity is system + value; different systems never merge.
        requisition?.value ? (requisition.system ?? '') : null,
        requisition?.value ?? null,
        JSON.stringify(requestWithMeta),
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
    notifyDatabaseChanged(['service_requests']);
  }
}

export async function fetchServiceRequestById(
  id: string,
  patientId?: string
): Promise<ServiceRequest | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM service_requests
     WHERE id = ? AND (? IS NULL OR patient_id = ?);`,
    [id, patientId ?? null, patientId ?? null]
  );
  return row ? withLastUpdated(row.fhir_json, row.updated_at) : null;
}

/** The patient's ServiceRequests, newest first. */
export async function fetchServiceRequestsByPatientId(
  patientId: string
): Promise<ServiceRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM service_requests
     WHERE patient_id = ?
     ORDER BY authored_on DESC, created_at DESC;`,
    [patientId]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** The patient's ServiceRequests whose `reason` references the Condition. */
export async function fetchServiceRequestsByReasonConditionId(
  conditionId: string,
  patientId: string
): Promise<ServiceRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ fhir_json: string; updated_at: string }>(
    `SELECT fhir_json, updated_at FROM service_requests
     WHERE patient_id = ?
     AND EXISTS (
       SELECT 1 FROM json_each(fhir_json, '$.reason')
       WHERE json_extract(value, '$.reference.reference') = ?
     )
     ORDER BY authored_on DESC, created_at DESC;`,
    [patientId, `Condition/${conditionId}`]
  );
  return rows.map((r) => withLastUpdated(r.fhir_json, r.updated_at));
}

/** Every ServiceRequest (optionally for one patient), for backups. */
export async function fetchAllServiceRequestRecords(
  patientId?: string
): Promise<{ request: ServiceRequest; patientId: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, patient_id, updated_at FROM service_requests
     ${patientId ? 'WHERE patient_id = ?' : ''}
     ORDER BY authored_on DESC, updated_at DESC;`,
    patientId ? [patientId] : []
  );
  return rows.map((r) => ({
    request: withLastUpdated(r.fhir_json, r.updated_at),
    patientId: r.patient_id,
  }));
}

/**
 * Deletes a ServiceRequest and, in the same transaction, removes its
 * Composition entries and `Encounter.basedOn` references.
 */
export async function deleteServiceRequestRecord(
  id: string,
  patientId?: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  let didDelete = false;

  const runDelete = async () => {
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      `SELECT patient_id FROM service_requests WHERE id = ?
       AND (? IS NULL OR patient_id = ?);`,
      [id, patientId ?? null, patientId ?? null]
    );
    if (!existing) return;

    const result = await db.runAsync(
      'DELETE FROM service_requests WHERE id = ? AND patient_id = ?;',
      [id, existing.patient_id]
    );
    if (!result.changes) return;

    const reference = `ServiceRequest/${id}`;
    await removeEntryFromAllDocuments(db, reference);

    const encounters = await db.getAllAsync<{ id: string; fhir_json: string }>(
      `SELECT id, fhir_json FROM consultations
       WHERE patient_id = ? AND fhir_json LIKE ?;`,
      [existing.patient_id, `%${reference}%`]
    );
    const now = new Date().toISOString();
    for (const row of encounters) {
      const encounter: Encounter = JSON.parse(row.fhir_json);
      const ids = getConsultationBasedOnIds(encounter);
      if (!ids.includes(id)) continue;
      const cleaned = withConsultationBasedOn(
        encounter,
        ids.filter((other) => other !== id)
      );
      cleaned.meta = { ...cleaned.meta, lastUpdated: now };
      await db.runAsync(
        'UPDATE consultations SET fhir_json = ?, updated_at = ? WHERE id = ?;',
        [JSON.stringify(cleaned), now, row.id]
      );
    }

    didDelete = true;
  };

  if (withinTransaction) {
    await runDelete();
  } else {
    await db.withTransactionAsync(runDelete);
    if (didDelete) {
      notifyDatabaseChanged([
        'service_requests',
        'clinical_documents',
        'consultations',
      ]);
    }
  }
}
