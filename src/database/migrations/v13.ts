import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([
  ['organizations', 'Organization', 'patient_id'],
]);

/**
 * Adds Organization storage for service providers (`Encounter.serviceProvider`
 * and `DiagnosticReport.performer`).
 *
 * Non-breaking and additive: creates a new table, its index and sync capture
 * triggers. Existing tables and data are untouched; references live in the
 * canonical Encounter and DiagnosticReport JSON. `repair` re-creates the
 * triggers on every start, because rebuilding a table drops them.
 */
export const migrationV13: DatabaseMigration = {
  version: 13,
  description: 'Add Organization storage with sync capture triggers',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_organizations_patient_name ON organizations(patient_id, name COLLATE NOCASE);
    ${triggers}
  `,
  async repair(db) {
    const hasTable = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'organizations';"
    );
    if (hasTable) await db.execAsync(triggers);
  },
};
