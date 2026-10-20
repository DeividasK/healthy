import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Composition,
  Condition,
  DiagnosticReport,
  Encounter,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  RequestOrchestration,
  ServiceRequest,
} from 'fhir/r5';
import type { DatabaseTable } from '@/src/database/dbEvents';
import { insertPatientRecord } from '@/src/features/profile/patientRepository';
import { insertOrganizationRecord } from '@/src/features/organizations/organizationsRepository';
import { insertConditionRecord } from '@/src/features/conditions/conditionsRepository';
import { insertDiagnosticReportRecord } from '@/src/features/lab-results/labResultsRepository';
import { insertConsultationRecord } from '@/src/features/consultations/consultationsRepository';
import { insertMedicationRequestRecord } from '@/src/features/treatments/treatmentsRepository';
import { insertMedicationStatementRecord } from '@/src/features/actions/medicationStatementsRepository';
import { insertMedicationAdministrationRecord } from '@/src/features/actions/medicationAdministrationsRepository';
import { insertServiceRequestRecord } from '@/src/features/service-requests/serviceRequestsRepository';
import { insertClinicalDocumentRecord } from '@/src/features/consultations/clinicalDocumentsRepository';
import { insertRequestOrchestrationRecord } from '@/src/features/bundles/bundlesRepository';
import {
  insertProfileSettingsRecord,
  type ProfileSettingsRecord,
} from '@/src/features/settings/profileSettingsRepository';
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
 * Every replicated record type: FHIR resources, plus profile settings (app
 * infrastructure). Adding a resource type to the app means
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
  ProfileSettings: {
    table: 'profile_settings',
    tables: ['profile_settings'],
    async read(db, id) {
      const row = await db.getFirstAsync<{ settings_json: string }>(
        'SELECT settings_json FROM profile_settings WHERE id = ?;',
        [id]
      );
      return row ? JSON.parse(row.settings_json) : null;
    },
    put: (record, patientId) =>
      insertProfileSettingsRecord(
        record as unknown as ProfileSettingsRecord,
        patientId,
        true
      ),
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
    // Deleting a treatment cascades to its logs and usage periods.
    tables: [
      'medication_requests',
      'medication_administrations',
      'medication_statements',
      'request_orchestrations',
    ],
    read: (db, id) => readJson(db, 'medication_requests', id),
    put: (resource, patientId) =>
      insertMedicationRequestRecord(
        resource as unknown as MedicationRequest,
        patientId,
        true
      ),
  },
  MedicationStatement: {
    table: 'medication_statements',
    tables: ['medication_statements'],
    read: (db, id) => readJson(db, 'medication_statements', id),
    put: (resource, patientId) =>
      insertMedicationStatementRecord(
        resource as unknown as MedicationStatement,
        patientId,
        true
      ),
  },
  MedicationAdministration: {
    table: 'medication_administrations',
    tables: ['medication_administrations'],
    read: (db, id) => readJson(db, 'medication_administrations', id),
    put: (resource, patientId) =>
      insertMedicationAdministrationRecord(
        resource as unknown as MedicationAdministration,
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
  RequestOrchestration: {
    table: 'request_orchestrations',
    tables: ['request_orchestrations'],
    read: (db, id) => readJson(db, 'request_orchestrations', id),
    put: (resource, patientId) =>
      insertRequestOrchestrationRecord(
        resource as unknown as RequestOrchestration,
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
