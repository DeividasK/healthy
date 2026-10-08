import type { DatabaseMigration } from './types';

export const migrationV5: DatabaseMigration = {
  version: 5,
  description: 'Add sync_account column to patients table for per-profile sync',
  isBreaking: false,
  sql: `
    ALTER TABLE patients ADD COLUMN sync_account TEXT;
  `,
};
