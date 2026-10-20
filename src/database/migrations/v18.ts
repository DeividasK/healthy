import type { DatabaseMigration } from './types';

const COLUMN = 'deletion_hold_hlc';

/**
 * Lets a device hold a profile that another device deleted from the cloud
 * until the user decides what to do with this device's copy, instead of
 * applying the deletion straight away.
 *
 * Non-breaking and additive: adds one nullable column to the `sync_profiles`
 * sync-metadata table, holding the HLC of the remote Patient deletion while
 * the decision is pending. No clinical table or FHIR JSON changes. The column
 * is added in `repair`, which runs on every start, so databases whose
 * `sync_profiles` was created or rebuilt by an earlier repair get it too.
 */
export const migrationV18: DatabaseMigration = {
  version: 18,
  description: 'Hold remotely deleted profiles until the user decides',
  isBreaking: false,
  sql: 'SELECT 1;',
  async repair(db) {
    const columns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(sync_profiles);'
    );
    if (!columns.some((column) => column.name === COLUMN))
      await db.execAsync(
        `ALTER TABLE sync_profiles ADD COLUMN ${COLUMN} TEXT;`
      );
  },
};
