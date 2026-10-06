import type { DatabaseMigration } from './types';

export const migrationV3: DatabaseMigration = {
  version: 3,
  description:
    'Conditions schema with destructive drop of legacy episodes_of_care',
  isBreaking: true,
  sql: `
    DROP TABLE IF EXISTS episodes_of_care;
    CREATE TABLE IF NOT EXISTS conditions (
      id TEXT PRIMARY KEY,
      clinical_status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      onset_date TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT,
      body_site TEXT,
      abatement_date TEXT,
      description TEXT,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
