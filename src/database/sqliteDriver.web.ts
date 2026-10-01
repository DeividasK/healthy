/**
 * Web driver stub: returns null to signal that db.ts should use AsyncStorage.
 * Prevents Metro from loading expo-sqlite and attempting to resolve wa-sqlite.wasm.
 */
export async function openNativeDatabase(_dbName: string): Promise<null> {
  return null;
}
