import AsyncStorage from '@react-native-async-storage/async-storage';
import { DatabaseExecutor, AppliedMigration, VersionedDatabaseFile } from './types';
import { MIGRATIONS, LATEST_DATABASE_VERSION } from './migrations';
import { LabReport } from '../types/health';

const LEGACY_STORAGE_KEY = '@healthy_lab_reports_v1';
const LEGACY_MIGRATION_FLAG_KEY = 'legacy_async_storage_imported_v1';

/**
 * Returns the current database schema version.
 */
export async function getCurrentDatabaseVersion(db: DatabaseExecutor): Promise<number> {
  try {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const pragmaVersion = row?.user_version ?? 0;

    // Also check schema_migrations table if it exists
    try {
      const tableCheck = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
      );
      if (tableCheck) {
        const migRow = await db.getFirstAsync<{ max_v: number }>(
          'SELECT MAX(version) as max_v FROM schema_migrations'
        );
        if (migRow && typeof migRow.max_v === 'number') {
          return Math.max(pragmaVersion, migRow.max_v);
        }
      }
    } catch {
      // Table may not exist yet
    }

    return pragmaVersion;
  } catch (error) {
    console.warn('Error reading database version, assuming 0:', error);
    return 0;
  }
}

/**
 * Returns list of applied migrations from schema_migrations table.
 */
export async function getAppliedMigrations(db: DatabaseExecutor): Promise<AppliedMigration[]> {
  try {
    const tableCheck = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
    );
    if (!tableCheck) {
      return [];
    }

    const rows = await db.getAllAsync<{ version: number; name: string; applied_at: string }>(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version ASC'
    );

    return rows.map((r) => ({
      version: r.version,
      name: r.name,
      appliedAt: r.applied_at,
    }));
  } catch (error) {
    console.warn('Error fetching applied migrations:', error);
    return [];
  }
}

/**
 * Runs all pending migrations up to LATEST_DATABASE_VERSION.
 */
export async function runMigrationsIfNeeded(db: DatabaseExecutor): Promise<{
  migratedCount: number;
  fromVersion: number;
  toVersion: number;
}> {
  const currentVersion = await getCurrentDatabaseVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pending.length === 0) {
    return {
      migratedCount: 0,
      fromVersion: currentVersion,
      toVersion: currentVersion,
    };
  }

  console.log(
    `[DB Migrations] Migrating database from version ${currentVersion} to ${LATEST_DATABASE_VERSION} (${pending.length} pending)...`
  );

  for (const migration of pending) {
    console.log(`[DB Migrations] Applying v${migration.version}: ${migration.name}`);
    await migration.up(db);

    const now = new Date().toISOString();
    await db.runAsync(
      'INSERT OR REPLACE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
      migration.version,
      migration.name,
      now
    );

    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }

  const finalVersion = await getCurrentDatabaseVersion(db);
  console.log(`[DB Migrations] Completed migrations. Database is now at v${finalVersion}`);

  // After migrations, check if legacy AsyncStorage data needs migration
  await migrateLegacyDataIfPresent(db);

  return {
    migratedCount: pending.length,
    fromVersion: currentVersion,
    toVersion: finalVersion,
  };
}

/**
 * Migrates any legacy reports stored in AsyncStorage into the SQLite database.
 */
export async function migrateLegacyDataIfPresent(db: DatabaseExecutor): Promise<number> {
  try {
    const metaCheck = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      LEGACY_MIGRATION_FLAG_KEY
    );
    if (metaCheck) {
      return 0; // Already imported
    }

    const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      // Mark as checked
      await db.runAsync(
        'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
        LEGACY_MIGRATION_FLAG_KEY,
        'true',
        new Date().toISOString()
      );
      return 0;
    }

    const legacyReports: LabReport[] = JSON.parse(legacyRaw);
    if (!Array.isArray(legacyReports) || legacyReports.length === 0) {
      await db.runAsync(
        'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
        LEGACY_MIGRATION_FLAG_KEY,
        'true',
        new Date().toISOString()
      );
      return 0;
    }

    console.log(`[DB Migrations] Migrating ${legacyReports.length} legacy reports from AsyncStorage...`);

    for (const report of legacyReports) {
      await db.runAsync(
        `INSERT OR REPLACE INTO lab_reports (
          id, test_date, lab_name, notes, created_at, updated_at, deleted_at, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        report.id,
        report.testDate,
        report.labName ?? null,
        report.notes ?? null,
        report.createdAt || new Date().toISOString(),
        report.updatedAt || new Date().toISOString(),
        null,
        1
      );

      if (Array.isArray(report.markers)) {
        for (const marker of report.markers) {
          await db.runAsync(
            `INSERT OR REPLACE INTO biomarker_results (
              id, report_id, loinc, canonical_key, name, category, value, unit, reference_min, reference_max, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            marker.id,
            report.id,
            marker.loinc ?? null,
            marker.canonicalKey,
            marker.name,
            marker.category,
            typeof marker.value === 'number' ? marker.value : null,
            marker.unit,
            typeof marker.referenceMin === 'number' ? marker.referenceMin : null,
            typeof marker.referenceMax === 'number' ? marker.referenceMax : null,
            marker.status,
            marker.notes ?? null
          );
        }
      }
    }

    // Mark as imported
    await db.runAsync(
      'INSERT OR REPLACE INTO app_meta (key, value, updated_at) VALUES (?, ?, ?)',
      LEGACY_MIGRATION_FLAG_KEY,
      'true',
      new Date().toISOString()
    );

    console.log(`[DB Migrations] Successfully migrated ${legacyReports.length} legacy reports to SQLite.`);
    return legacyReports.length;
  } catch (err) {
    console.error('Failed to migrate legacy AsyncStorage data to SQLite:', err);
    return 0;
  }
}

/**
 * Migrates a database snapshot payload from an older schema version if needed.
 */
export function migrateDataPayload(payload: VersionedDatabaseFile): VersionedDatabaseFile {
  let currentPayload = { ...payload };

  // Example payload migrations across schema versions:
  if (currentPayload.schemaVersion < 2) {
    // Schema v1 -> v2: Ensure reports have version and deletedAt attributes normalized
    currentPayload.reports = currentPayload.reports.map((report) => ({
      ...report,
      version: report.version ?? 1,
      deletedAt: report.deletedAt ?? null,
    }));
    currentPayload.schemaVersion = 2;
  }

  return currentPayload;
}
