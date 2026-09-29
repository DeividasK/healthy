import { Migration, DatabaseExecutor } from './types';

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    description: 'Initial relational schema for lab reports, biomarkers, and app metadata',
    up: async (db: DatabaseExecutor) => {
      await db.execAsync(`
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          applied_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS lab_reports (
          id TEXT PRIMARY KEY NOT NULL,
          test_date TEXT NOT NULL,
          lab_name TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          version INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_lab_reports_test_date ON lab_reports(test_date DESC);
        CREATE INDEX IF NOT EXISTS idx_lab_reports_updated_at ON lab_reports(updated_at DESC);

        CREATE TABLE IF NOT EXISTS biomarker_results (
          id TEXT PRIMARY KEY NOT NULL,
          report_id TEXT NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
          loinc TEXT,
          canonical_key TEXT NOT NULL,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          value REAL,
          unit TEXT NOT NULL,
          reference_min REAL,
          reference_max REAL,
          status TEXT NOT NULL,
          notes TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_biomarkers_report_id ON biomarker_results(report_id);
        CREATE INDEX IF NOT EXISTS idx_biomarkers_canonical_key ON biomarker_results(canonical_key);

        CREATE TABLE IF NOT EXISTS app_meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
    down: async (db: DatabaseExecutor) => {
      await db.execAsync(`
        DROP TABLE IF EXISTS biomarker_results;
        DROP TABLE IF EXISTS lab_reports;
        DROP TABLE IF EXISTS app_meta;
      `);
    },
  },
  {
    version: 2,
    name: 'add_sync_audit_and_device_meta',
    description: 'Adds sync audit logging table and device sync tracking',
    up: async (db: DatabaseExecutor) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_audit_log (
          id TEXT PRIMARY KEY NOT NULL,
          timestamp TEXT NOT NULL,
          action TEXT NOT NULL,
          status TEXT NOT NULL,
          device_id TEXT,
          details TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sync_audit_timestamp ON sync_audit_log(timestamp DESC);
      `);
    },
    down: async (db: DatabaseExecutor) => {
      await db.execAsync(`
        DROP TABLE IF EXISTS sync_audit_log;
      `);
    },
  },
];

export const LATEST_DATABASE_VERSION = Math.max(...MIGRATIONS.map((m) => m.version));
