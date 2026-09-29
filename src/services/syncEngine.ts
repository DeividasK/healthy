import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  logSyncAudit,
  getDeviceId,
  getLabReports,
} from '../database/db';
import { SyncMergeResult } from '../database/types';
import { getGoogleAuthState } from './googleAuth';
import {
  findDatabaseFile,
  downloadDatabaseFile,
  uploadDatabaseFile,
  DEFAULT_DATABASE_FILENAME,
} from './googleDrive';

const LAST_SYNC_KEY = '@healthy_last_sync_timestamp';
const AUTO_SYNC_KEY = '@healthy_auto_sync_enabled';

export type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncTime: string | null;
  lastResult: SyncMergeResult | null;
  error: string | null;
}

type SyncListener = (status: SyncStatus) => void;
const listeners = new Set<SyncListener>();

let currentStatus: SyncStatus = {
  state: 'idle',
  lastSyncTime: null,
  lastResult: null,
  error: null,
};

let autoSyncTimeout: any = null;

function notifyListeners() {
  for (const listener of listeners) {
    listener({ ...currentStatus });
  }
}

/**
 * Subscribe to sync engine status updates.
 */
export function subscribeToSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  listener({ ...currentStatus });
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/**
 * Loads persisted last sync time.
 */
export async function getLastSyncTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
}

/**
 * Checks if auto-sync is enabled.
 */
export async function isAutoSyncEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(AUTO_SYNC_KEY);
    return val === null ? true : val === 'true'; // Default true
  } catch {
    return true;
  }
}

/**
 * Sets auto-sync enabled or disabled.
 */
export async function setAutoSyncEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_SYNC_KEY, enabled ? 'true' : 'false');
}

/**
 * Performs a synchronization with Google Drive.
 */
export async function performSync(options?: {
  strategy?: 'smart-merge' | 'upload-only' | 'download-only';
  filename?: string;
}): Promise<SyncMergeResult> {
  const strategy = options?.strategy ?? 'smart-merge';
  const filename = options?.filename ?? DEFAULT_DATABASE_FILENAME;
  const deviceId = await getDeviceId();

  const auth = await getGoogleAuthState();
  if (!auth.isAuthenticated) {
    throw new Error('Please connect your Google Drive account first.');
  }

  currentStatus = {
    ...currentStatus,
    state: 'syncing',
    error: null,
  };
  notifyListeners();

  try {
    await logSyncAudit({
      action: strategy === 'upload-only' ? 'upload' : strategy === 'download-only' ? 'download' : 'merge',
      status: 'in_progress',
      deviceId,
      details: `Starting sync with strategy: ${strategy}`,
    });

    const existingFile = await findDatabaseFile(filename);

    let result: SyncMergeResult;

    if (strategy === 'upload-only' || !existingFile) {
      // Push local database to Drive
      const snapshot = await exportDatabaseSnapshot();
      const uploadedFile = await uploadDatabaseFile(snapshot, existingFile?.id, filename);

      const localReports = await getLabReports();
      result = {
        uploaded: true,
        downloaded: false,
        localCountBefore: localReports.length,
        remoteCountBefore: 0,
        mergedCount: localReports.length,
        updatedCount: localReports.length,
        conflictsResolved: 0,
        remoteFileId: uploadedFile.id,
        message: existingFile
          ? 'Successfully updated Google Drive file'
          : 'Created new database backup on Google Drive',
      };
    } else if (strategy === 'download-only') {
      // Pull remote database from Drive
      const remoteSnapshot = await downloadDatabaseFile(existingFile.id);
      result = await importDatabaseSnapshot(remoteSnapshot, 'replace');
      result.remoteFileId = existingFile.id;
    } else {
      // Smart Two-Way Merge
      console.log(`[Sync Engine] Downloading remote database file (${existingFile.id})...`);
      const remoteSnapshot = await downloadDatabaseFile(existingFile.id);

      console.log(`[Sync Engine] Merging remote records into local database...`);
      const mergeStats = await importDatabaseSnapshot(remoteSnapshot, 'merge');

      console.log(`[Sync Engine] Uploading merged database back to Google Drive...`);
      const mergedSnapshot = await exportDatabaseSnapshot();
      const uploadedFile = await uploadDatabaseFile(mergedSnapshot, existingFile.id, filename);

      result = {
        ...mergeStats,
        uploaded: true,
        remoteFileId: uploadedFile.id,
        message: `Synced successfully: ${mergeStats.updatedCount} items merged across devices`,
      };
    }

    const now = new Date().toISOString();
    await AsyncStorage.setItem(LAST_SYNC_KEY, now);

    await logSyncAudit({
      action: strategy === 'upload-only' ? 'upload' : strategy === 'download-only' ? 'download' : 'merge',
      status: 'success',
      deviceId,
      details: result.message || 'Sync completed successfully',
    });

    currentStatus = {
      state: 'success',
      lastSyncTime: now,
      lastResult: result,
      error: null,
    };
    notifyListeners();

    return result;
  } catch (error: any) {
    const errorMsg = error?.message || 'Sync failed due to an unknown error';
    console.error('[Sync Engine] Error during sync:', error);

    await logSyncAudit({
      action: 'error',
      status: 'failed',
      deviceId,
      details: errorMsg,
    });

    currentStatus = {
      ...currentStatus,
      state: 'error',
      error: errorMsg,
    };
    notifyListeners();

    throw error;
  }
}

/**
 * Debounces auto-sync 2.5 seconds after a user creates, edits, or deletes a report.
 */
export function triggerDebouncedAutoSync(): void {
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(async () => {
    try {
      const enabled = await isAutoSyncEnabled();
      if (!enabled) return;

      const auth = await getGoogleAuthState();
      if (!auth.isAuthenticated) return;

      console.log('[Sync Engine] Auto-sync triggered...');
      await performSync({ strategy: 'smart-merge' });
    } catch (err) {
      console.warn('[Sync Engine] Auto-sync background error:', err);
    }
  }, 2500);
}
