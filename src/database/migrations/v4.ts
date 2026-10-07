import type { DatabaseMigration } from './types';

export const migrationV4: DatabaseMigration = {
  version: 4,
  description:
    'Patients schema, app settings, and foreign key attachment of conditions and diagnostic reports to patient',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS patients (
      id            TEXT PRIMARY KEY,
      given_name    TEXT NOT NULL,
      family_name   TEXT,
      gender        TEXT,
      birth_date    TEXT,
      fhir_json     TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key           TEXT PRIMARY KEY,
      value         TEXT NOT NULL
    );

    ALTER TABLE conditions ADD COLUMN patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_conditions_patient_id ON conditions(patient_id);

    ALTER TABLE diagnostic_reports ADD COLUMN patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_patient_id ON diagnostic_reports(patient_id);
  `,
};
