import { DatabaseExecutor } from './types';

/**
 * Web/fallback driver when native SQLite is not available.
 * Returns null so db.ts falls back to AsyncStorage/In-Memory executor.
 */
export async function openNativeDatabase(
  _dbName: string
): Promise<DatabaseExecutor | null> {
  return null;
}
