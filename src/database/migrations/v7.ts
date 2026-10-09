import type { DatabaseMigration } from './types';

export const migrationV7: DatabaseMigration = {
  version: 7,
  description: 'Add service_type column to consultations table',
  isBreaking: false,
  sql: `
    ALTER TABLE consultations ADD COLUMN service_type TEXT;
    CREATE INDEX IF NOT EXISTS idx_consultations_service_type ON consultations(service_type);
  `,
};
