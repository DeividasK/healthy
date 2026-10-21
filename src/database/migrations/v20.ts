import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([['procedures', 'Procedure', 'patient_id']]);

/**
 * Adds Procedure storage for logs of scheduled service requests: whether a
 * repeated procedure or activity (e.g. a PRP session, daily meditation) was
 * done on a given day.
 *
 * Non-breaking and additive: creates a new table, its indexes and sync
 * capture triggers. Existing tables and data are untouched. Logs are removed
 * with their service request or patient by cascade, which the capture
 * triggers record as deletions. `repair` re-creates the triggers whenever
 * repairs run, because rebuilding a table drops them.
 */
export const migrationV20: DatabaseMigration = {
  version: 20,
  description: 'Add Procedure storage with sync capture triggers',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS procedures (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      service_request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      occurrence_date TEXT NOT NULL,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_procedures_patient_date ON procedures(patient_id, occurrence_date);
    CREATE INDEX IF NOT EXISTS idx_procedures_service_request_id ON procedures(service_request_id);
    ${triggers}
  `,
  async repair(db) {
    const hasTable = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'procedures';"
    );
    if (hasTable) await db.execAsync(triggers);
  },
};
