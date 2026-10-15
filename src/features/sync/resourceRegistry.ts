import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Composition,
  Condition,
  DiagnosticReport,
  Encounter,
  MedicationRequest,
  Observation,
  Organization,
  Patient,
  ServiceRequest,
} from 'fhir/r5';
import type { DatabaseTable } from '@/src/database/dbEvents';
import { insertPatientRecord } from '@/src/features/profile/patientRepository';
import { insertOrganizationRecord } from '@/src/features/organizations/organizationsRepository';
import { insertConditionRecord } from '@/src/features/conditions/conditionsRepository';
import { insertDiagnosticReportRecord } from '@/src/features/lab-results/labResultsRepository';
import { insertConsultationRecord } from '@/src/features/consultations/consultationsRepository';
import { insertMedicationRequestRecord } from '@/src/features/treatments/treatmentsRepository';
import { insertServiceRequestRecord } from '@/src/features/planned-care/plannedCareRepository';
import { insertClinicalDocumentRecord } from '@/src/features/consultations/clinicalDocumentsRepository';
import type { SyncResourceType } from './types';

type Resource = Record<string, unknown>;

interface ResourceEntry {
  table: string;
  /** Tables whose UI must refresh after this type changes. */
  tables: DatabaseTable[];
  /** Reads the canonical FHIR resource as replicated, or null when absent. */
  read(db: SQLiteDatabase, id: string): Promise<Resource | null>;
  /** Writes a replicated resource through the repository (validations included). */
  put(resource: Resource, patientId: string): Promise<void>;
}

async function readJson(
  db: SQLiteDatabase,
  table: string,
  id: string
): Promise<Resource | null> {
  const row = await db.getFirstAsync<{ fhir_json: string }>(
    `SELECT fhir_json FROM ${table} WHERE id = ?;`,
    [id]
  );
  return row ? JSON.parse(row.fhir_json) : null;
}

/**
 * Every replicated FHIR resource type. Adding a resource type to the app means
 * adding it here, to `SYNC_RESOURCE_TYPES` and to the capture triggers.
 */
export const RESOURCE_REGISTRY: Record<SyncResourceType, ResourceEntry> = {
  Patient: {
    table: 'patients',
    tables: ['patients'],
    read: (db, id) => readJson(db, 'patients', id),
    put: (resource) =>
      insertPatientRecord(resource as unknown as Patient, true),
  },
  Organization: {
    table: 'organizations',
    tables: ['organizations'],
    read: (db, id) => readJson(db, 'organizations', id),
    put: (resource, patientId) =>
      insertOrganizationRecord(
        resource as unknown as Organization,
        patientId,
        true
      ),
  },
  Condition: {
    table: 'conditions',
    tables: ['conditions', 'consultation_conditions'],
    read: (db, id) => readJson(db, 'conditions', id),
    put: (resource, patientId) =>
      insertConditionRecord(resource as unknown as Condition, patientId, true),
  },
  DiagnosticReport: {
    table: 'diagnostic_reports',
    tables: ['diagnostic_reports', 'observations'],
    async read(db, id) {
      const report = await readJson(db, 'diagnostic_reports', id);
      if (!report) return null;
      // Observations are stored in their own table but replicate inside the
      // report, as FHIR contained resources.
      const observations = await db.getAllAsync<{ fhir_json: string }>(
        'SELECT fhir_json FROM observations WHERE report_id = ? ORDER BY rowid;',
        [id]
      );
      return {
        ...report,
        contained: observations.map((row) => JSON.parse(row.fhir_json)),
      };
    },
    put: (resource, patientId) => {
      const { contained, ...report } = resource;
      return insertDiagnosticReportRecord(
        report as unknown as DiagnosticReport,
        (contained ?? []) as Observation[],
        patientId,
        true
      );
    },
  },
  Encounter: {
    table: 'consultations',
    tables: ['consultations', 'consultation_conditions'],
    read: (db, id) => readJson(db, 'consultations', id),
    put: (resource, patientId) =>
      insertConsultationRecord(
        resource as unknown as Encounter,
        patientId,
        true
      ),
  },
  MedicationRequest: {
    table: 'medication_requests',
    tables: ['medication_requests'],
    read: (db, id) => readJson(db, 'medication_requests', id),
    put: (resource, patientId) =>
      insertMedicationRequestRecord(
        resource as unknown as MedicationRequest,
        patientId,
        true
      ),
  },
  ServiceRequest: {
    table: 'service_requests',
    tables: ['service_requests'],
    read: (db, id) => readJson(db, 'service_requests', id),
    put: (resource, patientId) =>
      insertServiceRequestRecord(
        resource as unknown as ServiceRequest,
        patientId,
        true
      ),
  },
  Composition: {
    table: 'clinical_documents',
    tables: ['clinical_documents'],
    read: (db, id) => readJson(db, 'clinical_documents', id),
    put: (resource, patientId) =>
      insertClinicalDocumentRecord(
        resource as unknown as Composition,
        patientId,
        true
      ),
  },
};
