import type { DatabaseMigration } from './types';
import { captureTriggers } from './syncTriggers';

const triggers = captureTriggers([
  ['request_orchestrations', 'RequestOrchestration', 'patient_id'],
  ['profile_settings', 'ProfileSettings', 'patient_id'],
]);

/**
 * Adds treatment bundles (FHIR R5 RequestOrchestration) and per-profile
 * settings (app infrastructure, e.g. the clock time of each part of the day).
 *
 * Non-breaking and additive: creates two tables, an index and their sync
 * capture triggers. Existing tables and data are untouched. Bundle members
 * live in canonical JSON (`action.action.action.resource`); deleting a
 * treatment removes it from its bundles in the same transaction. `repair`
 * re-creates the triggers on every start, because rebuilding a table drops
 * them.
 */
export const migrationV18: DatabaseMigration = {
  version: 18,
  description:
    'Add treatment bundle (RequestOrchestration) and profile settings storage with sync capture triggers',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS request_orchestrations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_request_orchestrations_patient ON request_orchestrations(patient_id);
    CREATE TABLE IF NOT EXISTS profile_settings (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    ${triggers}
  `,
  async repair(db) {
    for (const table of ['request_orchestrations', 'profile_settings']) {
      const hasTable = await db.getFirstAsync(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?;",
        [table]
      );
      if (!hasTable) return;
    }
    await db.execAsync(triggers);
  },
};
