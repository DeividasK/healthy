import type { Composition } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { DEFAULT_PATIENT_ID } from '@/src/features/profile/patientRepository';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { isExistingNewerOrEqual } from '@/src/utils/dateUtils';
import {
  recordPendingClinicalResourceDeletion,
  clearPendingClinicalResourceDeletions,
} from '@/src/services/syncDeletions';

const VALID_COMPOSITION_STATUSES: Composition['status'][] = [
  'registered',
  'partial',
  'preliminary',
  'final',
  'amended',
  'corrected',
  'appended',
  'cancelled',
  'entered-in-error',
  'deprecated',
  'unknown',
];

/**
 * Persists a FHIR R5 Composition (clinical document) in SQLite.
 * Single unified implementation across Web, Android, and iOS.
 */
export async function insertClinicalDocumentRecord(
  document: Composition,
  patientId: string = DEFAULT_PATIENT_ID,
  isRemoteSync: boolean = false,
  withinTransaction: boolean = false
): Promise<void> {
  if (!document.id) {
    throw new Error('Clinical document requires an id to be persisted');
  }

  if (
    document.resourceType !== 'Composition' ||
    !VALID_COMPOSITION_STATUSES.includes(document.status)
  ) {
    throw new Error('Composition requires a valid FHIR R5 status');
  }

  const subjectRef = document.subject?.[0]?.reference;
  if (subjectRef && subjectRef !== `Patient/${patientId}`) {
    throw new Error('Composition subject must match its patient');
  }

  const encounterRef = document.encounter?.reference;
  if (!encounterRef?.startsWith('Encounter/')) {
    throw new Error('Composition requires an encounter reference');
  }
  const consultationId = encounterRef.slice(10);

  if (
    document.date?.includes('T') &&
    !/(Z|[+-]\d{2}:\d{2})$/.test(document.date)
  ) {
    throw new Error('Composition date-time requires a timezone offset');
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const incomingTimestamp = document.meta?.lastUpdated || now;
  const documentWithMeta: Composition = {
    ...document,
    meta: {
      ...document.meta,
      lastUpdated: incomingTimestamp,
    },
  };

  const docId = document.id;
  const status = document.status || 'preliminary';

  let didUpdate = false;
  const persist = async () => {
    // Validate consultation exists and belongs to the same patient
    const consultation = await db.getFirstAsync<{
      id: string;
      patient_id: string;
    }>(`SELECT id, patient_id FROM consultations WHERE id = ?;`, [
      consultationId,
    ]);
    if (!consultation) {
      throw new Error(
        `Consultation ${consultationId} not found for clinical document ${docId}`
      );
    }
    if (consultation.patient_id !== patientId) {
      throw new Error(
        `Cannot link document for patient ${patientId} to consultation belonging to ${consultation.patient_id}`
      );
    }

    const existing = await db.getFirstAsync<{
      patient_id: string;
      updated_at: string;
    }>(`SELECT patient_id, updated_at FROM clinical_documents WHERE id = ?;`, [
      docId,
    ]);
    if (existing?.patient_id && existing.patient_id !== patientId) {
      throw new Error(
        `Cannot update clinical document ${docId}: belongs to patient ${existing.patient_id}, not ${patientId}`
      );
    }

    // Last-write-wins for remote sync
    if (
      isRemoteSync &&
      existing?.updated_at &&
      isExistingNewerOrEqual(existing.updated_at, incomingTimestamp)
    ) {
      return;
    }

    await db.runAsync(
      `INSERT INTO clinical_documents (id, consultation_id, patient_id, status, fhir_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         consultation_id = excluded.consultation_id,
         patient_id = excluded.patient_id,
         status = excluded.status,
         fhir_json = excluded.fhir_json,
         updated_at = excluded.updated_at;`,
      [
        docId,
        consultationId,
        patientId,
        status,
        JSON.stringify(documentWithMeta),
        now,
        incomingTimestamp,
      ]
    );
    await clearPendingClinicalResourceDeletions(
      [{ resourceType: 'Composition', id: docId, patientId }],
      true
    );
    didUpdate = true;
  };

  if (withinTransaction) {
    await persist();
  } else {
    await db.withTransactionAsync(persist);
  }

  if (didUpdate) {
    if (!withinTransaction) {
      notifyDatabaseChanged(['clinical_documents']);
    }
  }
}

/**
 * Fetches the linked Composition for a Consultation by its consultationId.
 */
export async function fetchClinicalDocumentByConsultationId(
  consultationId: string,
  patientId?: string
): Promise<Composition | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM clinical_documents
     WHERE consultation_id = ?
     AND (? IS NULL OR patient_id = ?);`,
    [consultationId, patientId ?? null, patientId ?? null]
  );
  if (!row) return null;
  const comp: Composition = JSON.parse(row.fhir_json);
  if (!comp.meta?.lastUpdated && row.updated_at) {
    comp.meta = { ...comp.meta, lastUpdated: row.updated_at };
  }
  return comp;
}

/**
 * Fetches a single Composition document by its ID.
 */
export async function fetchClinicalDocumentById(
  id: string,
  patientId?: string
): Promise<Composition | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    fhir_json: string;
    updated_at: string;
  }>(
    `SELECT fhir_json, updated_at FROM clinical_documents
     WHERE id = ?
     AND (? IS NULL OR patient_id = ?);`,
    [id, patientId ?? null, patientId ?? null]
  );
  if (!row) return null;
  const comp: Composition = JSON.parse(row.fhir_json);
  if (!comp.meta?.lastUpdated && row.updated_at) {
    comp.meta = { ...comp.meta, lastUpdated: row.updated_at };
  }
  return comp;
}

/**
 * Fetches all clinical document records, optionally filtered by patientId.
 */
export async function fetchAllClinicalDocumentRecords(
  patientId?: string
): Promise<{ document: Composition; patientId: string }[]> {
  const db = await getDb();
  let query = `SELECT fhir_json, patient_id, updated_at FROM clinical_documents`;
  const params: string[] = [];
  if (patientId) {
    query += ` WHERE patient_id = ?`;
    params.push(patientId);
  }
  query += ` ORDER BY updated_at DESC;`;

  const rows = await db.getAllAsync<{
    fhir_json: string;
    patient_id: string;
    updated_at: string;
  }>(query, params);

  return rows.map((r) => {
    const doc: Composition = JSON.parse(r.fhir_json);
    if (!doc.meta?.lastUpdated && r.updated_at) {
      doc.meta = { ...doc.meta, lastUpdated: r.updated_at };
    }
    return {
      document: doc,
      patientId: r.patient_id,
    };
  });
}

/**
 * Deletes a clinical document record by ID.
 */
export async function deleteClinicalDocumentRecord(
  id: string,
  patientId?: string,
  withinTransaction: boolean = false
): Promise<void> {
  const db = await getDb();
  let didDelete = false;
  const runDelete = async () => {
    const existing = await db.getFirstAsync<{ patient_id: string }>(
      `SELECT patient_id FROM clinical_documents WHERE id = ?
       AND (? IS NULL OR patient_id = ?);`,
      [id, patientId ?? null, patientId ?? null]
    );
    if (!existing) return;
    const result = await db.runAsync(
      `DELETE FROM clinical_documents WHERE id = ? AND patient_id = ?;`,
      [id, existing.patient_id]
    );
    if (!result.changes) return;
    await recordPendingClinicalResourceDeletion(
      'Composition',
      id,
      existing.patient_id,
      true
    );
    didDelete = true;
  };

  if (withinTransaction) {
    await runDelete();
  } else {
    await db.withTransactionAsync(runDelete);
    if (didDelete) notifyDatabaseChanged(['clinical_documents']);
  }
}
