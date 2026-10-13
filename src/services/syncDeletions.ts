import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDb } from '@/src/database/db';

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

// Migration v10 creates the outbox. Import the legacy non-SQL key once,
// atomically with the first outbox operation. Keep the old key untouched so a
// rollback cannot lose deletions; the SQLite marker prevents reimport after ack.
const CLINICAL_OUTBOX_IMPORTED_KEY = 'clinical_deletion_outbox_v10_imported';

async function withClinicalOutbox<T>(
  action: () => Promise<T>,
  withinTransaction: boolean
): Promise<T> {
  const db = await getDb();
  const run = async () => {
    const imported = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?;',
      [CLINICAL_OUTBOX_IMPORTED_KEY]
    );
    if (!imported) {
      const raw = await AsyncStorage.getItem(
        PENDING_DELETED_CLINICAL_RESOURCES_KEY
      );
      const legacy: PendingDeletedClinicalResource[] = raw
        ? JSON.parse(raw)
        : [];
      for (const item of legacy) {
        await db.runAsync(
          `INSERT OR IGNORE INTO pending_clinical_resource_deletions
           (resource_type, resource_id, patient_id) VALUES (?, ?, ?);`,
          [item.resourceType, item.id, item.patientId]
        );
      }
      await db.runAsync(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?);',
        [CLINICAL_OUTBOX_IMPORTED_KEY, 'true']
      );
    }
    return await action();
  };
  if (withinTransaction) return await run();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await run();
  });
  return result;
}

/** Records a deletion in the same SQLite transaction as its resource. */
export async function recordPendingClinicalResourceDeletion(
  resourceType: string,
  id: string,
  patientId: string,
  withinTransaction = false
): Promise<void> {
  const db = await getDb();
  await withClinicalOutbox(async () => {
    await db.runAsync(
      `INSERT OR IGNORE INTO pending_clinical_resource_deletions
       (resource_type, resource_id, patient_id) VALUES (?, ?, ?);`,
      [resourceType, id, patientId]
    );
  }, withinTransaction);
}

/** Returns pending deletions, including any imported legacy queue entries. */
export async function getPendingDeletedClinicalResources(): Promise<
  PendingDeletedClinicalResource[]
> {
  const db = await getDb();
  return await withClinicalOutbox(
    () =>
      db.getAllAsync<PendingDeletedClinicalResource>(
        `SELECT resource_type AS resourceType, resource_id AS id, patient_id AS patientId
     FROM pending_clinical_resource_deletions;`
      ),
    false
  );
}

/** Acknowledges remote deletions, or cancels a tombstone when saving a resource. */
export async function clearPendingClinicalResourceDeletions(
  itemsToRemove: { resourceType: string; id: string; patientId?: string }[],
  withinTransaction = false
): Promise<void> {
  if (!itemsToRemove.length) return;
  const db = await getDb();
  await withClinicalOutbox(async () => {
    for (const item of itemsToRemove) {
      await db.runAsync(
        `DELETE FROM pending_clinical_resource_deletions
         WHERE resource_type = ? AND resource_id = ?
         AND (? IS NULL OR patient_id = ?);`,
        [
          item.resourceType,
          item.id,
          item.patientId ?? null,
          item.patientId ?? null,
        ]
      );
    }
  }, withinTransaction);
}
