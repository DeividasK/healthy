import type { DatabaseMigration } from './types';

export const migrationV10: DatabaseMigration = {
  version: 10,
  description: 'Add transactional clinical resource deletion outbox',
  isBreaking: false,
  sql: `
    CREATE TABLE pending_clinical_resource_deletions (
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      patient_id TEXT NOT NULL,
      PRIMARY KEY (resource_type, resource_id, patient_id)
    );
  `,
};
