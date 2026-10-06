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

    INSERT OR IGNORE INTO patients (id, given_name, family_name, gender, birth_date, fhir_json, created_at, updated_at)
    VALUES (
      'patient-default',
      'Self',
      NULL,
      'unknown',
      NULL,
      '{"resourceType":"Patient","id":"patient-default","active":true,"name":[{"use":"official","given":["Self"]}]}',
      strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
      strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    );

    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES ('active_patient_id', 'patient-default');

    ALTER TABLE conditions ADD COLUMN patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;
    UPDATE conditions SET patient_id = 'patient-default' WHERE patient_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_conditions_patient_id ON conditions(patient_id);

    ALTER TABLE diagnostic_reports ADD COLUMN patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE;
    UPDATE diagnostic_reports SET patient_id = 'patient-default' WHERE patient_id IS NULL;
    CREATE INDEX IF NOT EXISTS idx_diagnostic_reports_patient_id ON diagnostic_reports(patient_id);
  `,
};
