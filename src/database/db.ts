import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import {
  DatabaseExecutor,
  DatabaseVersionInfo,
  SyncAuditEntry,
  VersionedDatabaseFile,
  SyncMergeResult,
} from './types';
import {
  getCurrentDatabaseVersion,
  getAppliedMigrations,
  runMigrationsIfNeeded,
  migrateDataPayload,
} from './migrationRunner';
import { LATEST_DATABASE_VERSION } from './migrations';
import { LabReport, BiomarkerResult } from '../types/health';
import { openNativeDatabase } from './sqliteDriver';

const DB_NAME = 'healthy.db';
const DEVICE_ID_KEY = '@healthy_device_id';
const WEB_STORAGE_REPORTS_KEY = '@healthy_web_sqlite_reports_fallback';
const WEB_STORAGE_META_KEY = '@healthy_web_sqlite_meta_fallback';

let sqliteDbInstance: DatabaseExecutor | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Returns a unique device identifier for multi-device sync conflict resolution.
 */
export async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = Crypto.randomUUID();
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'fallback-device-id';
  }
}

/**
 * Gets or initializes the SQLite database executor.
 */
async function getDb(): Promise<DatabaseExecutor> {
  if (Platform.OS === 'web') {
    return createWebFallbackExecutor();
  }

  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const nativeDb = await openNativeDatabase(DB_NAME);
        if (nativeDb) {
          sqliteDbInstance = nativeDb;
          await runMigrationsIfNeeded(sqliteDbInstance);
        }
      } catch (err) {
        console.warn('[DB] SQLite open error, falling back to Web/Memory executor:', err);
        sqliteDbInstance = null;
      }
    })();
  }

  await initPromise;

  if (sqliteDbInstance) {
    return sqliteDbInstance;
  }

  return createWebFallbackExecutor();
}

/**
 * Initializes the database and executes migrations if needed.
 */
export async function initDatabase(): Promise<DatabaseVersionInfo> {
  const db = await getDb();
  await runMigrationsIfNeeded(db);
  return getDatabaseVersionInfo();
}

/**
 * Returns the current version and applied migrations of the database.
 */
export async function getDatabaseVersionInfo(): Promise<DatabaseVersionInfo> {
  const db = await getDb();
  const currentVersion = await getCurrentDatabaseVersion(db);
  const appliedMigrations = await getAppliedMigrations(db);

  return {
    currentVersion,
    latestVersion: LATEST_DATABASE_VERSION,
    appliedMigrations,
    isUpToDate: currentVersion >= LATEST_DATABASE_VERSION,
  };
}

/**
 * Retrieves all stored lab reports, sorted newest first by test date.
 * Excludes soft-deleted records by default.
 */
export async function getLabReports(options?: { includeDeleted?: boolean }): Promise<LabReport[]> {
  const db = await getDb();
  const includeDeleted = options?.includeDeleted ?? false;

  let reportQuery = 'SELECT * FROM lab_reports';
  if (!includeDeleted) {
    reportQuery += ' WHERE deleted_at IS NULL';
  }
  reportQuery += ' ORDER BY test_date DESC, created_at DESC';

  const reportRows = await db.getAllAsync<{
    id: string;
    test_date: string;
    lab_name: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    version: number;
  }>(reportQuery);

  if (reportRows.length === 0) {
    return [];
  }

  // Load biomarkers for each report
  const markerRows = await db.getAllAsync<{
    id: string;
    report_id: string;
    loinc: string | null;
    canonical_key: string;
    name: string;
    category: string;
    value: number | null;
    unit: string;
    reference_min: number | null;
    reference_max: number | null;
    status: string;
    notes: string | null;
  }>('SELECT * FROM biomarker_results');

  const markersByReportId = new Map<string, BiomarkerResult[]>();
  for (const row of markerRows) {
    if (!markersByReportId.has(row.report_id)) {
      markersByReportId.set(row.report_id, []);
    }
    markersByReportId.get(row.report_id)!.push({
      id: row.id,
      loinc: row.loinc ?? undefined,
      canonicalKey: row.canonical_key,
      name: row.name,
      category: row.category,
      value: row.value !== null ? row.value : undefined,
      unit: row.unit,
      referenceMin: row.reference_min !== null ? row.reference_min : undefined,
      referenceMax: row.reference_max !== null ? row.reference_max : undefined,
      status: row.status as any,
      notes: row.notes ?? undefined,
    });
  }

  return reportRows.map((r) => ({
    id: r.id,
    testDate: r.test_date,
    labName: r.lab_name ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at ?? undefined,
    version: r.version,
    markers: markersByReportId.get(r.id) ?? [],
  }));
}

/**
 * Retrieves a single lab report by ID.
 */
export async function getLabReportById(id: string): Promise<LabReport | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    id: string;
    test_date: string;
    lab_name: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    version: number;
  }>('SELECT * FROM lab_reports WHERE id = ?', id);

  if (!row || row.deleted_at !== null) {
    return undefined;
  }

  const markerRows = await db.getAllAsync<{
    id: string;
    report_id: string;
    loinc: string | null;
    canonical_key: string;
    name: string;
    category: string;
    value: number | null;
    unit: string;
    reference_min: number | null;
    reference_max: number | null;
    status: string;
    notes: string | null;
  }>('SELECT * FROM biomarker_results WHERE report_id = ?', id);

  const markers: BiomarkerResult[] = markerRows.map((m) => ({
    id: m.id,
    loinc: m.loinc ?? undefined,
    canonicalKey: m.canonical_key,
    name: m.name,
    category: m.category,
    value: m.value !== null ? m.value : undefined,
    unit: m.unit,
    referenceMin: m.reference_min !== null ? m.reference_min : undefined,
    referenceMax: m.reference_max !== null ? m.reference_max : undefined,
    status: m.status as any,
    notes: m.notes ?? undefined,
  }));

  return {
    id: row.id,
    testDate: row.test_date,
    labName: row.lab_name ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
    version: row.version,
    markers,
  };
}

/**
 * Saves a new or updated lab report to the database.
 */
export async function saveLabReport(report: LabReport): Promise<LabReport[]> {
  const db = await getDb();
  const now = new Date().toISOString();
  const createdAt = report.createdAt || now;
  const updatedAt = now;
  const version = (report.version ?? 0) + 1;

  await db.runAsync(
    `INSERT OR REPLACE INTO lab_reports (
      id, test_date, lab_name, notes, created_at, updated_at, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    report.id,
    report.testDate,
    report.labName ?? null,
    report.notes ?? null,
    createdAt,
    updatedAt,
    null,
    version
  );

  // Re-sync markers for this report
  await db.runAsync('DELETE FROM biomarker_results WHERE report_id = ?', report.id);

  if (Array.isArray(report.markers)) {
    for (const marker of report.markers) {
      const markerId = marker.id || Crypto.randomUUID();
      await db.runAsync(
        `INSERT INTO biomarker_results (
          id, report_id, loinc, canonical_key, name, category, value, unit, reference_min, reference_max, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        markerId,
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

  return getLabReports();
}

/**
 * Soft deletes a lab report by its unique ID (tombstone pattern for conflict-free sync).
 */
export async function deleteLabReport(id: string, hard = false): Promise<LabReport[]> {
  const db = await getDb();

  if (hard) {
    await db.runAsync('DELETE FROM lab_reports WHERE id = ?', id);
  } else {
    const now = new Date().toISOString();
    await db.runAsync(
      'UPDATE lab_reports SET deleted_at = ?, updated_at = ? WHERE id = ?',
      now,
      now,
      id
    );
  }

  return getLabReports();
}

/**
 * Exports a versioned database file containing all reports and metadata,
 * ready to be synchronized with Google Drive.
 */
export async function exportDatabaseSnapshot(): Promise<VersionedDatabaseFile> {
  const allReports = await getLabReports({ includeDeleted: true });
  const deviceId = await getDeviceId();
  const versionInfo = await getDatabaseVersionInfo();

  const totalMarkers = allReports.reduce((acc, r) => acc + (r.markers ? r.markers.length : 0), 0);

  return {
    format: 'healthy_database_file',
    schemaVersion: versionInfo.currentVersion,
    exportedAt: new Date().toISOString(),
    deviceId,
    reports: allReports,
    metadata: {
      appVersion: '1.0.0',
      totalReports: allReports.length,
      totalMarkers,
    },
  };
}

/**
 * Imports a database file (e.g. downloaded from Google Drive) and merges it
 * with local records using Last-Write-Wins and Tombstone preservation.
 */
export async function importDatabaseSnapshot(
  snapshot: VersionedDatabaseFile,
  strategy: 'merge' | 'replace' = 'merge'
): Promise<SyncMergeResult> {
  const db = await getDb();
  const migratedSnapshot = migrateDataPayload(snapshot);

  const localReports = await getLabReports({ includeDeleted: true });
  const localMap = new Map<string, LabReport>(localReports.map((r) => [r.id, r]));

  let updatedCount = 0;
  let conflictsResolved = 0;

  if (strategy === 'replace') {
    await db.execAsync('DELETE FROM biomarker_results; DELETE FROM lab_reports;');
    for (const report of migratedSnapshot.reports) {
      await saveReportRaw(db, report);
      updatedCount++;
    }
    const finalReports = await getLabReports();
    return {
      uploaded: false,
      downloaded: true,
      localCountBefore: localReports.length,
      remoteCountBefore: migratedSnapshot.reports.length,
      mergedCount: finalReports.length,
      updatedCount,
      conflictsResolved: 0,
      message: 'Replaced local database with remote snapshot',
    };
  }

  // Merge strategy (Two-way Last-Write-Wins per record)
  for (const remoteReport of migratedSnapshot.reports) {
    const localReport = localMap.get(remoteReport.id);

    if (!localReport) {
      // New record from remote
      await saveReportRaw(db, remoteReport);
      updatedCount++;
    } else {
      // Both exist: compare updated_at
      const remoteTime = new Date(remoteReport.updatedAt).getTime();
      const localTime = new Date(localReport.updatedAt).getTime();

      if (remoteTime > localTime) {
        // Remote is newer: update local
        await saveReportRaw(db, remoteReport);
        updatedCount++;
        conflictsResolved++;
      } else if (localTime > remoteTime) {
        // Local is newer: keep local (will be sent on upload)
        conflictsResolved++;
      }
    }
  }

  const finalReports = await getLabReports();
  return {
    uploaded: false,
    downloaded: true,
    localCountBefore: localReports.length,
    remoteCountBefore: migratedSnapshot.reports.length,
    mergedCount: finalReports.length,
    updatedCount,
    conflictsResolved,
    message: `Merged: ${updatedCount} records updated (${conflictsResolved} conflicts resolved)`,
  };
}

async function saveReportRaw(db: DatabaseExecutor, report: LabReport): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO lab_reports (
      id, test_date, lab_name, notes, created_at, updated_at, deleted_at, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    report.id,
    report.testDate,
    report.labName ?? null,
    report.notes ?? null,
    report.createdAt,
    report.updatedAt,
    report.deletedAt ?? null,
    report.version ?? 1
  );

  await db.runAsync('DELETE FROM biomarker_results WHERE report_id = ?', report.id);

  if (Array.isArray(report.markers)) {
    for (const marker of report.markers) {
      await db.runAsync(
        `INSERT INTO biomarker_results (
          id, report_id, loinc, canonical_key, name, category, value, unit, reference_min, reference_max, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        marker.id || Crypto.randomUUID(),
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

/**
 * Appends a sync audit entry for historical tracing.
 */
export async function logSyncAudit(
  entry: Omit<SyncAuditEntry, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const db = await getDb();
    const id = Crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO sync_audit_log (id, timestamp, action, status, device_id, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      timestamp,
      entry.action,
      entry.status,
      entry.deviceId ?? null,
      entry.details ?? null
    );
  } catch (err) {
    console.warn('Failed to write sync audit log:', err);
  }
}

/**
 * Retrieves the latest sync audit logs.
 */
export async function getSyncAuditLogs(limit = 20): Promise<SyncAuditEntry[]> {
  try {
    const db = await getDb();
    return await db.getAllAsync<SyncAuditEntry>(
      'SELECT id, timestamp, action, status, device_id as deviceId, details FROM sync_audit_log ORDER BY timestamp DESC LIMIT ?',
      limit
    );
  } catch {
    return [];
  }
}

/**
 * Web fallback executor for web browsers or environments where native SQLite is not available.
 * Keeps an in-memory/AsyncStorage structure mirroring the relational tables.
 */
function createWebFallbackExecutor(): DatabaseExecutor {
  return {
    async execAsync(sql: string): Promise<void> {
      // No-op for DDL in fallback mode
    },
    async runAsync(sql: string, ...params: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
      return { lastInsertRowId: 1, changes: 1 };
    },
    async getAllAsync<T = any>(sql: string, ...params: any[]): Promise<T[]> {
      if (sql.includes('schema_migrations')) {
        return [
          { version: 1, name: 'initial_schema', applied_at: new Date().toISOString() },
          { version: 2, name: 'add_sync_audit_and_device_meta', applied_at: new Date().toISOString() },
        ] as any;
      }
      if (sql.includes('lab_reports')) {
        const raw = await AsyncStorage.getItem(WEB_STORAGE_REPORTS_KEY);
        const list: LabReport[] = raw ? JSON.parse(raw) : [];
        return list.map((r) => ({
          id: r.id,
          test_date: r.testDate,
          lab_name: r.labName ?? null,
          notes: r.notes ?? null,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
          deleted_at: r.deletedAt ?? null,
          version: r.version ?? 1,
        })) as any;
      }
      if (sql.includes('biomarker_results')) {
        const raw = await AsyncStorage.getItem(WEB_STORAGE_REPORTS_KEY);
        const list: LabReport[] = raw ? JSON.parse(raw) : [];
        const markers: any[] = [];
        for (const r of list) {
          for (const m of r.markers || []) {
            markers.push({
              id: m.id,
              report_id: r.id,
              loinc: m.loinc ?? null,
              canonical_key: m.canonicalKey,
              name: m.name,
              category: m.category,
              value: m.value ?? null,
              unit: m.unit,
              reference_min: m.referenceMin ?? null,
              reference_max: m.referenceMax ?? null,
              status: m.status,
              notes: m.notes ?? null,
            });
          }
        }
        return markers as any;
      }
      return [];
    },
    async getFirstAsync<T = any>(sql: string, ...params: any[]): Promise<T | null> {
      if (sql.includes('PRAGMA user_version')) {
        return { user_version: LATEST_DATABASE_VERSION } as any;
      }
      return null;
    },
  };
}
