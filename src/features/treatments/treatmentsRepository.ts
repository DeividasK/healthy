import type { MedicationRequest } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { removeEntryFromAllDocuments } from '@/src/features/consultations/consultationDocumentEntries';
import { removeFromBundles } from '@/src/features/bundles/bundlesRepository';

export const VALID_MEDICATION_REQUEST_STATUSES: MedicationRequest['status'][] =
  [
    'active',
    'on-hold',
    'ended',
    'stopped',
    'completed',
    'cancelled',
    'entered-in-error',
    'draft',
    'unknown',
  ];

export const VALID_MEDICATION_REQUEST_INTENTS: MedicationRequest['intent'][] = [
  'proposal',
  'plan',
  'order',
  'original-order',
  'reflex-order',
  'filler-order',
  'instance-order',
  'option',
];

/**
 * Persists a FHIR R5 MedicationRequest (treatment recommendation or order) in SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertMedicationRequestRecord(
  request: MedicationRequest,
  patientId: string = DEFAULT_PATIENT_ID,
  withinTransaction: boolean = false
): Promise<void> {
  if (!request.id) {
    throw new Error('MedicationRequest requires an id to be persisted');
  }

  if (request.resourceType !== 'MedicationRequest') {
    throw new Error('Resource must have resourceType MedicationRequest');
  }

  if (!VALID_MEDICATION_REQUEST_STATUSES.includes(request.status)) {
    throw new Error(`Invalid MedicationRequest status: ${request.status}`);
  }

  if (!VALID_MEDICATION_REQUEST_INTENTS.includes(request.intent)) {
    throw new Error(`Invalid MedicationRequest intent: ${request.intent}`);
  }

  const subjectRef = request.subject?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('MedicationRequest subject must match its patient');
  }

  if (
    request.authoredOn?.includes('T') &&
    !/(Z|[+-]\d{2}:\d{2})$/.test(request.authoredOn)
  ) {
    throw new Error('MedicationRequest authoredOn requires a timezone offset');
  }

  const encounterRef = request.encounter?.reference;
  let consultationId: string | null = null;
  if (encounterRef) {
    if (!encounterRef.startsWith('Encounter/')) {
      throw new Error(
        'MedicationRequest encounter must reference an Encounter'
      );
    }
    consultationId = encounterRef.slice(10);
  }

  const displayLabel = getTreatmentTitle(request);
  if (!displayLabel || displayLabel.trim() === '') {
    throw new Error('MedicationRequest requires a medication name/label');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = request.meta?.lastUpdated || now;
  const requestWithMeta: MedicationRequest = {
    ...request,
    meta: {
      ...request.meta,
      lastUpdated: incomingTimestamp,
    },
    subject: {
      ...request.subject,
      reference: `Patient/${patientId}`,
    },
  };

  const reqId = request.id;
  const status = request.status || 'unknown';
  const intent = request.intent || 'plan';
  const authoredOn = request.authoredOn || now.split('T')[0];

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
          'Treatment reason must reference a condition for the same patient'
        );
      }
    }
    // If linked to an originating consultation, validate consultation belongs to the same patient
    if (consultationId) {
      const consultation = await db.getFirstAsync<{
        id: string;
        patient_id: string;
      }>(`SELECT id, patient_id FROM consultations WHERE id = ?;`, [
        consultationId,
      ]);
      if (!consultation) {
        throw new Error(
          `Consultation ${consultationId} not found for MedicationRequest ${reqId}`
        );
      }
      if (consultation.patient_id !== patientId) {
        throw new Error(
          `Cannot link MedicationRequest for patient ${patientId} to consultation belonging to ${consultation.patient_id}`
        );
      }
    }

    const existing = await db.getFirstAsync<{
      patient_id: string;
      updated_at: string;
    }>(`SELECT patient_id, updated_at FROM medication_requests WHERE id = ?;`, [
      reqId,
    ]);
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update MedicationRequest ${reqId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    await db.runAsync(
      `INSERT INTO medication_requests (
         id, patient_id, consultation_id, display_label, status, intent, authored_on, fhir_json, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patient_id = excluded.patient_id,
         consultation_id = excluded.consultation_id,
         display_label = excluded.display_label,
         status = excluded.status,
         intent = excluded.intent,
         authored_on = excluded.authored_on,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        reqId,
        patientId,
        consultationId,
        displayLabel,
        status,
        intent,
        authoredOn,
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
    notifyDatabaseChanged(['medication_requests']);
  }
}

/**
 * Fetches a single MedicationRequest by its ID.
 */
export async function fetchMedicationRequestById(
  id: string,
  patientId?: string
): Promise<MedicationRequest | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM medication_requests
     WHERE id = ?
     AND (? IS NULL OR patient_id = ?);`,
    [id, patientId ?? null, patientId ?? null]
  );
  if (!row) return null;
  const req: MedicationRequest = JSON.parse(row.fhir_json);
  if (!req.meta?.lastUpdated && row.updated_at) {
    req.meta = { ...req.meta, lastUpdated: row.updated_at };
  }
  return req;
}

/**
 * Fetches all MedicationRequests for a specific patient, ordered by authored date descending.
 */
export async function fetchMedicationRequestsByPatientId(
  patientId: string
): Promise<MedicationRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM medication_requests
     WHERE patient_id = ?
     ORDER BY authored_on DESC, created_at DESC;`,
    [patientId]
  );
  return rows.map((r) => {
    const req: MedicationRequest = JSON.parse(r.fhir_json);
    if (!req.meta?.lastUpdated && r.updated_at) {
      req.meta = { ...req.meta, lastUpdated: r.updated_at };
    }
    return req;
  });
}

/**
 * Fetches a patient's MedicationRequests whose `reason` references the
 * Condition, newest first.
 */
export async function fetchMedicationRequestsByReasonConditionId(
  conditionId: string,
  patientId: string
): Promise<MedicationRequest[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM medication_requests
     WHERE patient_id = ?
     AND EXISTS (
       SELECT 1 FROM json_each(fhir_json, '$.reason')
       WHERE json_extract(value, '$.reference.reference') = ?
     )
     ORDER BY authored_on DESC, created_at DESC;`,
    [patientId, `Condition/${conditionId}`]
  );
  return rows.map((r) => {
    const req: MedicationRequest = JSON.parse(r.fhir_json);
    if (!req.meta?.lastUpdated && r.updated_at) {
      req.meta = { ...req.meta, lastUpdated: r.updated_at };
    }
    return req;
  });
}

/**
 * Fetches all MedicationRequest records across all patients (or filtered by patientId).
 */
export async function fetchAllMedicationRequestRecords(
  patientId?: string
): Promise<{ request: MedicationRequest; patientId: string }[]> {
  const db = await getDb();
  let query = `SELECT fhir_json, patient_id, updated_at FROM medication_requests`;
  const params: string[] = [];
  if (patientId) {
    query += ` WHERE patient_id = ?`;
    params.push(patientId);
  }
  query += ` ORDER BY authored_on DESC, updated_at DESC;`;

  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(query, params);

  return rows.map((r) => {
    const req: MedicationRequest = JSON.parse(r.fhir_json);
    if (!req.meta?.lastUpdated && r.updated_at) {
      req.meta = { ...req.meta, lastUpdated: r.updated_at };
    }
    return {
      request: req,
      patientId: r.patient_id,
    };
  });
}

/**
 * Deletes a MedicationRequest record by ID and cleans all references in Compositions.
 */
export async function deleteMedicationRequestRecord(
  id: string,
  patientId?: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  let didDelete = false;

  const runDelete = async () => {
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      `SELECT patient_id FROM medication_requests WHERE id = ?
       AND (? IS NULL OR patient_id = ?);`,
      [id, patientId ?? null, patientId ?? null]
    );
    if (!existing) return;

    const result = await db.runAsync(
      `DELETE FROM medication_requests WHERE id = ? AND patient_id = ?;`,
      [id, existing.patient_id]
    );
    if (!result.changes) return;

    // Deletion and reference cleanup must commit together. The treatment's
    // logs (MedicationAdministrations) and usage periods (MedicationStatements)
    // go with it by cascade.
    await removeEntryFromAllDocuments(db, `MedicationRequest/${id}`);
    await removeFromBundles(db, `MedicationRequest/${id}`, existing.patient_id);

    didDelete = true;
  };

  if (withinTransaction) {
    await runDelete();
  } else {
    await db.withTransactionAsync(runDelete);
    if (didDelete) {
      notifyDatabaseChanged([
        'medication_requests',
        'medication_administrations',
        'medication_statements',
        'clinical_documents',
        'request_orchestrations',
      ]);
    }
  }
}
