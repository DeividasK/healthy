import { Platform } from 'react-native';
import { openNativeDatabase } from './sqliteDriver';
import { getWebDatabase } from './indexedDb';

// Re-export feature repositories for backward compatibility and clean access
export * from '../features/lab-results/labResultsRepository';
export * from '../features/conditions/conditionsRepository';

const DB_NAME = 'healthy.db';
let nativeDb: any = null;
let isDbInitialized = false;

/**
 * Returns the active native SQLite database instance, if available.
 */
export function getNativeDb(): any {
  return nativeDb;
}

/**
 * Initializes the database tables with versioned migrations.
 */
export async function initializeDatabase(): Promise<void> {
  if (isDbInitialized) return;

  if (Platform.OS === 'web') {
    try {
      await getWebDatabase();
    } catch (err) {
      console.warn('Web IndexedDB init failed:', err);
    }
    isDbInitialized = true;
    return;
  }

  try {
    nativeDb = await openNativeDatabase(DB_NAME);
    if (nativeDb) {
      await nativeDb.execAsync('PRAGMA foreign_keys = ON;');

      // Query current schema version
      const verRow = (await nativeDb.getFirstAsync('PRAGMA user_version;')) as
        { user_version?: number } | undefined;
      const currentVersion = verRow?.user_version ?? 0;

      // Migration v1: diagnostic_reports and observations
      if (currentVersion < 1) {
        await nativeDb.execAsync(`
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
          PRAGMA user_version = 1;
        `);
      }

      // Migration v3: conditions (destructive migration from episodes_of_care)
      if (currentVersion < 3) {
        await nativeDb.execAsync(`
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
          PRAGMA user_version = 3;
        `);
      }
    }
  } catch (err) {
    console.warn('Native SQLite init failed:', err);
    nativeDb = null;
  }

  isDbInitialized = true;
}
