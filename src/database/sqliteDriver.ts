import * as SQLite from 'expo-sqlite';

/**
 * Native and Web SQLite driver.
 * Uses expo-sqlite's unified asynchronous API across iOS, Android, and Web.
 */
export async function openNativeDatabase(
  dbName: string
): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(dbName);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}
