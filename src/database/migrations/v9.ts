import type { DatabaseMigration } from './types';

/** Additive: persist consultation clinical narratives as FHIR R5 Composition documents */
export const migrationV9: DatabaseMigration = {
  version: 9,
  description:
    'Add clinical_documents table for consultation Composition narratives',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS clinical_documents (
      id              TEXT PRIMARY KEY,
      consultation_id TEXT UNIQUE REFERENCES consultations(id) ON DELETE CASCADE,
      patient_id      TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      status          TEXT NOT NULL,
      fhir_json       TEXT NOT NULL,
      created_at      TEXT NOT NULL,
      updated_at      TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_clinical_documents_patient_id ON clinical_documents(patient_id);
    CREATE INDEX IF NOT EXISTS idx_clinical_documents_consultation_id ON clinical_documents(consultation_id);
  `,
};
