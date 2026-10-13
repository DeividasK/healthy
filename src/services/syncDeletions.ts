import AsyncStorage from '@react-native-async-storage/async-storage';

export const PENDING_DELETED_CONSULTATIONS_KEY =
  '@healthy_pending_deleted_consultations';

export const PENDING_DELETED_CLINICAL_RESOURCES_KEY =
  '@healthy_pending_deleted_clinical_resources';

export interface PendingDeletedClinicalResource {
  resourceType: string;
  id: string;
  patientId: string;
}

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

/**
 * Persists a clinical resource deletion (e.g. Composition) scoped by resource type, ID and patientId.
 */
export async function recordPendingClinicalResourceDeletion(
  resourceType: string,
  id: string,
  patientId: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(
      PENDING_DELETED_CLINICAL_RESOURCES_KEY
    );
    const list: PendingDeletedClinicalResource[] = raw
      ? (JSON.parse(raw) as PendingDeletedClinicalResource[])
      : [];
    const exists = list.some(
      (item) =>
        item.resourceType === resourceType &&
        item.id === id &&
        item.patientId === patientId
    );
    if (!exists) {
      list.push({ resourceType, id, patientId });
      await AsyncStorage.setItem(
        PENDING_DELETED_CLINICAL_RESOURCES_KEY,
        JSON.stringify(list)
      );
    }
  } catch (err) {
    console.warn('Failed to record pending clinical resource deletion:', err);
  }
}

/**
 * Returns all pending deleted clinical resources.
 */
export async function getPendingDeletedClinicalResources(): Promise<
  PendingDeletedClinicalResource[]
> {
  try {
    const raw = await AsyncStorage.getItem(
      PENDING_DELETED_CLINICAL_RESOURCES_KEY
    );
    return raw ? (JSON.parse(raw) as PendingDeletedClinicalResource[]) : [];
  } catch (err) {
    console.warn('Failed to load pending deleted clinical resources:', err);
    return [];
  }
}

/**
 * Clears completed clinical resource deletions from the sync state.
 */
export async function clearPendingClinicalResourceDeletions(
  itemsToRemove: { resourceType: string; id: string; patientId?: string }[]
): Promise<void> {
  if (itemsToRemove.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(
      PENDING_DELETED_CLINICAL_RESOURCES_KEY
    );
    const list: PendingDeletedClinicalResource[] = raw
      ? (JSON.parse(raw) as PendingDeletedClinicalResource[])
      : [];
    const remaining = list.filter(
      (item) =>
        !itemsToRemove.some(
          (rem) =>
            rem.resourceType === item.resourceType &&
            rem.id === item.id &&
            (!rem.patientId || rem.patientId === item.patientId)
        )
    );
    if (remaining.length === 0) {
      await AsyncStorage.removeItem(PENDING_DELETED_CLINICAL_RESOURCES_KEY);
    } else {
      await AsyncStorage.setItem(
        PENDING_DELETED_CLINICAL_RESOURCES_KEY,
        JSON.stringify(remaining)
      );
    }
  } catch (err) {
    console.warn('Failed to clear pending clinical resource deletions:', err);
  }
}
