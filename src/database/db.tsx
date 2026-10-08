import React, { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';
import { openNativeDatabase } from './sqliteDriver';
import { DATABASE_MIGRATIONS } from './migrations';
import { COLORS } from '../theme/colors';

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
    if (currentVersion < migration.version) {
      await db.withTransactionAsync(async () => {
        await db.execAsync(migration.sql);
        await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      });
      currentVersion = migration.version;
    }
  }

  dbInstance = db;
}

export interface DatabaseProviderProps {
  children: React.ReactNode;
}

/**
 * Configured SQLiteProvider for the Healthy application.
 * Manages the SQLite database connection, PRAGMA setup, and schema migrations.
 */
export function DatabaseProvider({ children }: DatabaseProviderProps) {
  return (
    <Suspense
      fallback={
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
      }
    >
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
  await db.execAsync(`
    DELETE FROM observations;
    DELETE FROM diagnostic_reports;
    DELETE FROM conditions;
    DELETE FROM app_settings;
    DELETE FROM patients;
  `);
}
