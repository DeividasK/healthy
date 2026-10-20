import React, { Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { openNativeDatabase } from './sqliteDriver';
import { DATABASE_MIGRATIONS } from './migrations';
import { notifyDatabaseChanged } from './dbEvents';
import { claimDatabaseTab, whenDatabaseTabOwned } from './databaseTabLock';
import { DatabaseInUseView } from '@/src/features/app/DatabaseInUseView';
import { COLORS } from '@/src/theme/colors';

export * from './migrations';

export const DB_NAME = 'healthy.db';
let dbInstance: SQLiteDatabase | null = null;
let initPromise: Promise<SQLiteDatabase> | null = null;

/**
 * Returns the active SQLite database instance, if available.
 */
export function getNativeDb(): SQLiteDatabase | null {
  return dbInstance;
}

/**
 * Applies PRAGMAs and migrations to a database instance.
 * Used by expo-sqlite's SQLiteProvider onInit callback.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  // Query current schema version
  const verRow = (await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version;'
  )) as { user_version?: number } | null | undefined;
  let currentVersion = verRow?.user_version ?? 0;

  // Sequentially apply missing migrations
  for (const migration of DATABASE_MIGRATIONS) {
    const pending = currentVersion < migration.version;
    if (pending || migration.repair) {
      await db.withTransactionAsync(async () => {
        if (pending) await db.execAsync(migration.sql);
        await migration.repair?.(db);
        if (pending)
          await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      });
      if (pending) currentVersion = migration.version;
    }
  }

  serializeTransactions(db);
  dbInstance = db;
}

/**
 * Makes transactions on the shared connection run one at a time.
 * expo-sqlite's `withTransactionAsync` is not exclusive: another caller's
 * statements could otherwise run inside an open transaction, for example
 * while sync applies remote changes with change capture suppressed.
 * `withExclusiveTransactionAsync` would isolate it, but is not available on web.
 */
function serializeTransactions(db: SQLiteDatabase): void {
  const patched = db as SQLiteDatabase & { transactionsSerialized?: boolean };
  if (patched.transactionsSerialized) return;
  const run = db.withTransactionAsync.bind(db);
  let queue: Promise<unknown> = Promise.resolve();
  db.withTransactionAsync = (task) => {
    const next = queue.then(() => run(task));
    queue = next.catch(() => undefined);
    return next;
  };
  patched.transactionsSerialized = true;
}

export interface DatabaseProviderProps {
  children: React.ReactNode;
}

function DatabaseLoading() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.light.background,
      }}
    >
      <ActivityIndicator size="large" color={COLORS.light.primary} />
    </View>
  );
}

/**
 * Configured SQLiteProvider for the Healthy application.
 * Manages the SQLite database connection, PRAGMA setup, and schema migrations.
 * On web, only one tab opens the database; others wait until it closes.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [owned, setOwned] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    claimDatabaseTab().then((claimed) => {
      if (active) setOwned((current) => current || claimed);
    });
    whenDatabaseTabOwned().then(() => {
      if (active) setOwned(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (owned === null) return <DatabaseLoading />;
  if (!owned) {
    return (
      <DatabaseInUseView
        onRetry={async () => {
          if (await claimDatabaseTab()) setOwned(true);
        }}
      />
    );
  }

  return (
    <Suspense fallback={<DatabaseLoading />}>
      <SQLiteProvider
        databaseName={DB_NAME}
        onInit={migrateDatabase}
        useSuspense
      >
        {children}
      </SQLiteProvider>
    </Suspense>
  );
}

/**
 * Returns the active SQLite database instance or throws if not initialized.
 */
export async function getDb(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  return await initializeDatabase();
}

/**
 * Initializes the database tables with versioned migrations.
 * Executes the exact same versioned SQL migrations across Web, Android, and iOS.
 */
export async function initializeDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await whenDatabaseTabOwned();
      const db = await openNativeDatabase(DB_NAME);
      await migrateDatabase(db);
      return db;
    } catch (err) {
      console.error('Failed to initialize SQLite database:', err);
      initPromise = null;
      throw err;
    }
  })();

  return initPromise;
}

/**
 * Resets the active database connection (useful for testing).
 */
export function resetDatabaseInstance(): void {
  dbInstance = null;
  initPromise = null;
}

/**
 * Deletes all records from all application tables and notifies subscribers (useful for tests/resets).
 */
export async function clearAllDatabaseTables(): Promise<void> {
  const db = await getDb();
  // A transaction waits for any in progress, so no write lands half-cleared.
  await db.withTransactionAsync(() =>
    db.execAsync(`
    DELETE FROM observations;
    DELETE FROM diagnostic_reports;
    DELETE FROM clinical_documents;
    DELETE FROM request_orchestrations;
    DELETE FROM profile_settings;
    DELETE FROM medication_administrations;
    DELETE FROM medication_statements;
    DELETE FROM medication_requests;
    DELETE FROM service_requests;
    DELETE FROM consultation_conditions;
    DELETE FROM consultations;
    DELETE FROM conditions;
    DELETE FROM organizations;
    DELETE FROM app_settings;
    DELETE FROM patients;
    -- A reset device starts with no sync history and a new device identity.
    DELETE FROM sync_dirty;
    DELETE FROM sync_changes;
    DELETE FROM sync_row_versions;
    DELETE FROM sync_remote_devices;
    DELETE FROM sync_profiles;
    DELETE FROM sync_pending_apply;
    UPDATE sync_device SET device_id = lower(hex(randomblob(8))),
      hlc_last = NULL, last_seq = 0, snapshot_seq = 0, space_id = NULL,
      provider_cursor = NULL;
  `)
  );
  notifyDatabaseChanged([
    'observations',
    'diagnostic_reports',
    'clinical_documents',
    'medication_requests',
    'service_requests',
    'medication_administrations',
    'medication_statements',
    'request_orchestrations',
    'profile_settings',
    'consultations',
    'consultation_conditions',
    'conditions',
    'organizations',
    'patients',
    'app_settings',
  ]);
}
