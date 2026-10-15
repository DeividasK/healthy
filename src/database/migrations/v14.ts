import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([
  ['service_requests', 'ServiceRequest', 'patient_id'],
]);

/**
 * Adds ServiceRequest storage for planned care (investigations, procedures,
 * referrals and follow-ups).
 *
 * Non-breaking and additive: creates a new table, its indexes and sync
 * capture triggers. Existing tables and data are untouched; `Encounter.basedOn`
 * lives in canonical Encounter JSON and needs no projection. The requisition
 * columns project `ServiceRequest.requisition` for grouped requests. `repair`
 * re-creates the triggers on every start, because rebuilding a table drops them.
 */
export const migrationV14: DatabaseMigration = {
  version: 14,
  description: 'Add ServiceRequest storage with sync capture triggers',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      consultation_id TEXT REFERENCES consultations(id) ON DELETE SET NULL,
      display_label TEXT NOT NULL,
      status TEXT NOT NULL,
      intent TEXT NOT NULL,
      category_code TEXT,
      authored_on TEXT NOT NULL,
      occurrence TEXT,
      requisition_system TEXT,
      requisition_value TEXT,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_service_requests_patient_id ON service_requests(patient_id);
    CREATE INDEX IF NOT EXISTS idx_service_requests_consultation_id ON service_requests(consultation_id);
    CREATE INDEX IF NOT EXISTS idx_service_requests_requisition ON service_requests(patient_id, requisition_system, requisition_value);
    ${triggers}
  `,
  async repair(db) {
    const hasTable = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'service_requests';"
    );
    if (hasTable) await db.execAsync(triggers);
  },
};
