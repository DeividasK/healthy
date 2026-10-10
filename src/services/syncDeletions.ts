import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_DELETED_CONSULTATIONS_KEY =
  '@healthy_pending_deleted_consultations';

/**
 * Persists a consultation deletion ID to sync state so remote sync
 * deletes the remote file and avoids restoring it prematurely.
 */
export async function recordPendingConsultationDeletion(
  id: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETED_CONSULTATIONS_KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      await AsyncStorage.setItem(
        PENDING_DELETED_CONSULTATIONS_KEY,
        JSON.stringify(ids)
      );
    }
  } catch (err) {
    console.warn('Failed to record pending consultation deletion:', err);
  }
}

/**
 * Returns all consultation IDs pending deletion from remote storage.
 */
export async function getPendingDeletedConsultationIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETED_CONSULTATIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (err) {
    console.warn('Failed to load pending deleted consultation IDs:', err);
    return [];
  }
}

/**
 * Removes completed consultation deletions from the sync state.
 */
export async function clearPendingConsultationDeletions(
  idsToRemove: string[]
): Promise<void> {
  if (idsToRemove.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(PENDING_DELETED_CONSULTATIONS_KEY);
    const ids: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const remaining = ids.filter((id) => !idsToRemove.includes(id));
    if (remaining.length === 0) {
      await AsyncStorage.removeItem(PENDING_DELETED_CONSULTATIONS_KEY);
    } else {
      await AsyncStorage.setItem(
        PENDING_DELETED_CONSULTATIONS_KEY,
        JSON.stringify(remaining)
      );
    }
  } catch (err) {
    console.warn('Failed to clear pending consultation deletions:', err);
  }
}
