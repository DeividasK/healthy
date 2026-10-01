/**
 * Fallback driver interface.
 */
export async function openNativeDatabase(_dbName: string): Promise<any | null> {
  return null;
}
