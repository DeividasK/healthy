import type { DatabaseMigration } from './types';

export const migrationV6: DatabaseMigration = {
  version: 6,
  description:
    'Add consultations schema with foreign keys to patients and conditions',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS consultations (
      id            TEXT PRIMARY KEY,
      patient_id    TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      condition_id  TEXT REFERENCES conditions(id) ON DELETE SET NULL,
      date          TEXT NOT NULL,
      doctor_name   TEXT,
      title         TEXT NOT NULL,
      notes         TEXT,
      status        TEXT NOT NULL,
      fhir_json     TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_consultations_patient_id ON consultations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_condition_id ON consultations(condition_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(date);
  `,
};
