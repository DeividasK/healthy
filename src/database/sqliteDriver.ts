import { DatabaseExecutor } from './types';

/**
 * Default fallback driver signature for TypeScript and non-native environments.
 */
export async function openNativeDatabase(
  _dbName: string
): Promise<DatabaseExecutor | null> {
  return null;
}
