import * as SQLite from 'expo-sqlite';
import { DatabaseExecutor } from './types';

/**
 * Native SQLite driver for iOS and Android.
 */
export async function openNativeDatabase(
  dbName: string
): Promise<DatabaseExecutor> {
  const db = await SQLite.openDatabaseAsync(dbName);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  return db;
}
