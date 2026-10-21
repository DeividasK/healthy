import type { DatabaseMigration } from './types';
import { captureTriggers, markDirty, NOW_MS } from './syncTriggers';

// Canonical clinical tables replicated by sync, with the FHIR type they store
// and the column naming the owning patient.
const replicatedTables = [
  ['patients', 'Patient', 'id'],
  ['conditions', 'Condition', 'patient_id'],
  ['diagnostic_reports', 'DiagnosticReport', 'patient_id'],
  ['consultations', 'Encounter', 'patient_id'],
  ['medication_requests', 'MedicationRequest', 'patient_id'],
  ['clinical_documents', 'Composition', 'patient_id'],
] as const;

const triggers = [
  captureTriggers(replicatedTables),
  // Observations travel inside their DiagnosticReport (`contained`).
  ...(['INSERT', 'UPDATE', 'DELETE'] as const).map((event) => {
    const row = event === 'DELETE' ? 'OLD' : 'NEW';
    return `
    CREATE TRIGGER IF NOT EXISTS sync_observations_${event.toLowerCase()} AFTER ${event} ON observations
    WHEN NOT EXISTS (SELECT 1 FROM sync_suppress)
    BEGIN${markDirty(
      'DiagnosticReport',
      `${row}.report_id`,
      `(SELECT patient_id FROM diagnostic_reports WHERE id = ${row}.report_id)`
    )}
    END;`;
  }),
].join('\n');

const backfill = replicatedTables
  .map(
    ([table, type, patientColumn]) => `
    INSERT OR IGNORE INTO sync_dirty (resource_type, resource_id, patient_id, changed_ms)
    SELECT '${type}', id, ${patientColumn},
      COALESCE(CAST((julianday(updated_at) - 2440587.5) * 86400000 AS INTEGER), ${NOW_MS})
    FROM ${table};`
  )
  .join('\n');

const schema = `
    CREATE TABLE IF NOT EXISTS sync_device (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      device_id TEXT NOT NULL,
      hlc_last TEXT,
      last_seq INTEGER NOT NULL DEFAULT 0,
      snapshot_seq INTEGER NOT NULL DEFAULT 0,
      space_id TEXT,
      provider_cursor TEXT
    );
    INSERT OR IGNORE INTO sync_device (singleton, device_id)
      VALUES (1, lower(hex(randomblob(8))));

    -- Present only inside transactions applying remote changes or removing
    -- data from this device, so the capture triggers stay silent.
    CREATE TABLE IF NOT EXISTS sync_suppress (singleton INTEGER PRIMARY KEY);

    CREATE TABLE IF NOT EXISTS sync_dirty (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      patient_id TEXT,
      changed_ms INTEGER NOT NULL,
      PRIMARY KEY (resource_type, resource_id)
    );

    CREATE TABLE IF NOT EXISTS sync_changes (
      hlc TEXT PRIMARY KEY,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      patient_id TEXT,
      op TEXT NOT NULL CHECK (op IN ('put', 'delete')),
      payload TEXT,
      chunk_seq INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_sync_changes_resource ON sync_changes(resource_type, resource_id);
    CREATE INDEX IF NOT EXISTS idx_sync_changes_chunk_seq ON sync_changes(chunk_seq);

    CREATE TABLE IF NOT EXISTS sync_row_versions (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      patient_id TEXT,
      hlc TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (resource_type, resource_id)
    );
    CREATE INDEX IF NOT EXISTS idx_sync_row_versions_patient ON sync_row_versions(patient_id);

    CREATE TABLE IF NOT EXISTS sync_remote_devices (
      device_id TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL DEFAULT 0
    );

    -- Profiles known to sync on this device: whether this device syncs it
    -- (opt-in per profile), whether another device keeps it in the cloud, and
    -- whether this device deleted its cloud copy while keeping it locally.
    CREATE TABLE IF NOT EXISTS sync_profiles (
      patient_id TEXT PRIMARY KEY,
      display_name TEXT,
      synced INTEGER NOT NULL DEFAULT 0,
      in_cloud INTEGER NOT NULL DEFAULT 0,
      cloud_deleted INTEGER NOT NULL DEFAULT 0
    );

    -- Remote changes whose references did not resolve yet; retried each sync.
    CREATE TABLE IF NOT EXISTS sync_pending_apply (
      hlc TEXT PRIMARY KEY,
      change_json TEXT NOT NULL,
      error TEXT
    );
`;

/**
 * Adds the local-first sync change log (ADR 0001).
 *
 * Breaking: the `repair` step drops `pending_clinical_resource_deletions`
 * after converting its entries into change-log tombstones, so older app
 * versions lose their deletion outbox. It also re-creates the capture
 * triggers whenever repairs run, because rebuilding a table drops them, and creates
 * the tables if a database marked v12 lacks them. All clinical tables and
 * their data are untouched, and
 * `patients.sync_account` stays but is no longer read.
 *
 * Every existing resource is backfilled as changed (timestamped from
 * `updated_at`), so the first sync uploads the complete local record.
 */
export const migrationV12: DatabaseMigration = {
  version: 12,
  description: 'Add the HLC sync change log, capture triggers and backfill',
  isBreaking: true,
  sql: `
    ${schema}
    ${backfill}

    DELETE FROM app_settings WHERE key = 'clinical_deletion_outbox_v10_imported';
  `,
  async repair(db) {
    // A database already marked v12 by another schema lineage (for example an
    // older branch) skipped this migration; create and backfill the tables.
    const hasChangeLog = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'sync_dirty';"
    );
    if (!hasChangeLog) await db.execAsync(migrationV12.sql);
    // Idempotent: also adds tables introduced while v12 was unreleased.
    await db.execAsync(schema);
    await db.execAsync('DROP TABLE IF EXISTS sync_excluded_patients;');
    // Rebuilding a table (as older repairs do) drops its triggers; restore them.
    await db.execAsync(triggers);
    const outbox = await db.getFirstAsync(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'pending_clinical_resource_deletions';"
    );
    if (!outbox) return;
    await db.execAsync(`
      INSERT OR IGNORE INTO sync_dirty (resource_type, resource_id, patient_id, changed_ms)
      SELECT resource_type, resource_id, patient_id, ${NOW_MS}
      FROM pending_clinical_resource_deletions;
      DROP TABLE pending_clinical_resource_deletions;
    `);
  },
};
