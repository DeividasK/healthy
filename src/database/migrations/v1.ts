import type { DatabaseMigration } from './types';

export const migrationV1: DatabaseMigration = {
  version: 1,
  description: 'Initial schema for diagnostic reports and observations',
  isBreaking: false,
  sql: `
    CREATE TABLE IF NOT EXISTS diagnostic_reports (
      id TEXT PRIMARY KEY,
      effective_date TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL REFERENCES diagnostic_reports(id) ON DELETE CASCADE,
      loinc_code TEXT NOT NULL,
      name TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      fhir_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `,
};
