import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([
  ['medication_administrations', 'MedicationAdministration', 'patient_id'],
]);

/**
 * Adds MedicationAdministration storage for treatment logs: whether a
 * treatment was taken on a given day.
 *
 * Non-breaking and additive: creates a new table, its indexes and sync
 * capture triggers. Existing tables and data are untouched. Logs are removed
 * with their treatment or patient by cascade, which the capture triggers
 * record as deletions. `repair` re-creates the triggers whenever repairs run,
 * because rebuilding a table drops them.
 */
export const migrationV15: DatabaseMigration = {
  version: 15,
  description:
    'Add MedicationAdministration storage with sync capture triggers',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS medication_administrations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      medication_request_id TEXT NOT NULL REFERENCES medication_requests(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      occurrence_date TEXT NOT NULL,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_medication_administrations_patient_date ON medication_administrations(patient_id, occurrence_date);
    CREATE INDEX IF NOT EXISTS idx_medication_administrations_request_id ON medication_administrations(medication_request_id);
    ${triggers}
  `,
  async repair(db) {
    const hasTable = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'medication_administrations';"
    );
    if (hasTable) await db.execAsync(triggers);
  },
};
