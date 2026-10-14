import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  loadGisScript,
  silentRefreshWebAccessToken,
} from '@/src/services/googleAuthWebService';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import {
  type GoogleDriveConfig,
  loadGoogleDriveConfig,
  saveGoogleDriveConfig,
  refreshGoogleAccessToken,
} from '@/src/features/sync/googleAccount';
import { createGoogleDriveProvider } from '@/src/features/sync/providers/googleDriveProvider';
import type { CloudStorageProvider } from '@/src/features/sync/providers/types';
import {
  VaultAlreadyExistsError,
  VaultMissingError,
  createVault,
  deleteCloudData,
  forgetVaultKey,
  hasRemoteVault,
  hasUnsyncedLocalChanges,
  importLegacyTombstones,
  loadVaultKeys,
  restoreExcludedPatient,
  syncOnce,
  unlockVault,
} from '@/src/features/sync/engine';

export type SyncState = 'idle' | 'syncing' | 'just_synced' | 'error';

/**
 * `locked`: a Google account is connected but this device has not entered
 * the recovery phrase yet, so nothing can be read or written.
 */
export type VaultState = 'disconnected' | 'locked' | 'unlocked';

export interface GoogleAuthData {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userSub: string;
  userEmail?: string;
  userName?: string;
}

interface SyncContextValue {
  syncState: SyncState;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isUpToDate: boolean;
  syncError: string | null;
  isAuthExpired: boolean;
  config: GoogleDriveConfig | null;
  vaultState: VaultState;
  syncNow: () => Promise<void>;
  /**
   * Connects Google Drive. A new vault needs its phrase shown, an existing one
   * needs it entered; without `createIfMissing` an empty Drive stays unconnected.
   */
  connectWithGoogle: (
    authData: GoogleAuthData,
    options?: { createIfMissing?: boolean }
  ) => Promise<'created' | 'needs-phrase' | 'missing'>;
  unlockWithPhrase: (phrase: string) => Promise<void>;
  /**
   * For a forgotten phrase: deletes the unreadable cloud data and sets up a
   * new vault. This device's records are kept and uploaded again.
   */
  startOverWithNewPhrase: () => Promise<void>;
  disconnect: (options?: { deleteCloudData?: boolean }) => Promise<void>;
  restoreExcludedProfile: (patientId: string) => Promise<void>;
  clearError: () => void;
  refreshConfig: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const PUSH_DELAY_MS = 2000;
const POLL_INTERVAL_MS = 60 * 1000;

function isAuthError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === 'GoogleAuthExpiredError' ||
      err.message.includes('HTTP 401') ||
      err.message.includes('Invalid Credentials') ||
      err.message.includes('UNAUTHENTICATED'))
  );
}

/** Obtains a new Google access token without user interaction, if possible. */
async function refreshAccessToken(
  config: GoogleDriveConfig
): Promise<GoogleDriveConfig | null> {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  if (config.refreshToken && clientId) {
    const refreshed = await refreshGoogleAccessToken(
      config.refreshToken,
      clientId
    );
    return {
      ...config,
      accessToken: refreshed.accessToken,
      tokenExpiresAt: refreshed.expiresIn
        ? Date.now() + refreshed.expiresIn * 1000
        : undefined,
    };
  }
  if (Platform.OS === 'web') {
    const refreshed = await silentRefreshWebAccessToken(config.userEmail);
    return {
      ...config,
      accessToken: refreshed.accessToken,
      tokenExpiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
  }
  return null;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GoogleDriveConfig | null>(null);
  const [vaultState, setVaultState] = useState<VaultState>('disconnected');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isUpToDate, setIsUpToDate] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState<boolean>(false);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const lastFocusSyncRef = useRef<number>(0);
  const configRef = useRef<GoogleDriveConfig | null>(config);

  const updateConfig = useCallback(async (next: GoogleDriveConfig | null) => {
    await saveGoogleDriveConfig(next);
    configRef.current = next;
    setConfig(next);
  }, []);

  const refreshConfig = useCallback(async () => {
    const loaded = await loadGoogleDriveConfig();
    configRef.current = loaded;
    setConfig(loaded);
    if (loaded?.lastSyncTimestamp)
      setLastSyncedAt(new Date(loaded.lastSyncTimestamp));
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        if (Platform.OS === 'web') {
          loadGisScript().catch((err) => {
            console.warn('Failed to preload GIS script:', err);
          });
        }
        await importLegacyTombstones().catch((err) =>
          console.warn('Failed to import queued deletions:', err)
        );
        const loaded = await loadGoogleDriveConfig();
        const keys = loaded ? await loadVaultKeys() : null;
        if (!isMounted) return;
        configRef.current = loaded;
        setConfig(loaded);
        setVaultState(!loaded ? 'disconnected' : keys ? 'unlocked' : 'locked');
        if (loaded?.lastSyncTimestamp)
          setLastSyncedAt(new Date(loaded.lastSyncTimestamp));
        setIsUpToDate(!(await hasUnsyncedLocalChanges()));
      } catch (err) {
        console.warn('Failed to load sync config:', err);
      }
    })();

    return () => {
      isMounted = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, []);

  /**
   * Runs a cloud operation with a fresh access token, refreshing once and
   * retrying when Google reports an expired session.
   */
  const withProvider = useCallback(
    async <T,>(
      operation: (provider: CloudStorageProvider) => Promise<T>
    ): Promise<T> => {
      let active = configRef.current;
      if (!active) throw new Error('Google Drive is not connected.');
      if (
        active.tokenExpiresAt &&
        Date.now() >= active.tokenExpiresAt - 60000
      ) {
        try {
          const refreshed = await refreshAccessToken(active);
          if (refreshed) {
            active = refreshed;
            await updateConfig(refreshed);
          }
        } catch (err) {
          console.warn('Preemptive token refresh failed:', err);
        }
      }
      try {
        return await operation(createGoogleDriveProvider(active.accessToken));
      } catch (err) {
        if (!isAuthError(err)) throw err;
        const refreshed = await refreshAccessToken(active).catch(
          (refreshErr) => {
            console.warn('Token refresh retry failed:', refreshErr);
            return null;
          }
        );
        if (!refreshed) throw err;
        await updateConfig(refreshed);
        return await operation(
          createGoogleDriveProvider(refreshed.accessToken)
        );
      }
    },
    [updateConfig]
  );

  const syncNow = useCallback(async (): Promise<void> => {
    if (!configRef.current) return;
    if (inFlightSyncRef.current) return inFlightSyncRef.current;
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    const performSync = async () => {
      const keys = await loadVaultKeys();
      if (!keys) {
        setVaultState('locked');
        return;
      }
      setSyncState('syncing');
      setSyncError(null);
      setIsAuthExpired(false);
      try {
        await withProvider((provider) => syncOnce(provider, keys));
        const now = new Date();
        if (configRef.current)
          await updateConfig({
            ...configRef.current,
            lastSyncTimestamp: now.toISOString(),
          });
        setLastSyncedAt(now);
        setIsUpToDate(!(await hasUnsyncedLocalChanges()));
        setSyncState('just_synced');
        resetTimerRef.current = setTimeout(() => setSyncState('idle'), 1000);
      } catch (err: unknown) {
        if (isAuthError(err)) {
          // A later focus or poll retries once Google issues a fresh token.
          console.warn('Google Drive session expired; sync will retry:', err);
          setSyncState('idle');
          setIsUpToDate(false);
          return;
        }
        if (err instanceof VaultMissingError) {
          await forgetVaultKey();
          await updateConfig(null);
          setVaultState('disconnected');
        }
        console.error('Sync failed:', err);
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Failed to sync with Google Drive.'
        );
        setIsUpToDate(false);
        setSyncState('error');
      }
    };

    inFlightSyncRef.current = performSync().finally(() => {
      inFlightSyncRef.current = null;
    });
    return inFlightSyncRef.current;
  }, [updateConfig, withProvider]);

  // Upload local edits shortly after they are saved.
  useDatabaseSubscription(
    [
      'patients',
      'conditions',
      'diagnostic_reports',
      'observations',
      'consultations',
      'clinical_documents',
      'medication_requests',
    ],
    () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(async () => {
        try {
          if (!(await hasUnsyncedLocalChanges())) return;
          setIsUpToDate(false);
          if (vaultState === 'unlocked') await syncNow();
        } catch (err) {
          console.warn('Scheduled upload failed:', err);
        }
      }, PUSH_DELAY_MS);
    }
  );

  // Pull other devices' changes on start, periodically and when the app
  // comes back.
  useEffect(() => {
    if (vaultState !== 'unlocked') return;
    syncNow();

    const interval = setInterval(() => {
      if (!inFlightSyncRef.current) syncNow();
    }, POLL_INTERVAL_MS);

    const handleWakeup = () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 2000) return;
      if (inFlightSyncRef.current) return;
      lastFocusSyncRef.current = now;
      syncNow();
    };
    const onVisibilityChange = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      )
        handleWakeup();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', handleWakeup);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') handleWakeup();
      }
    );

    return () => {
      clearInterval(interval);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWakeup);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      appStateSub.remove();
    };
  }, [vaultState, syncNow]);

  const connectWithGoogle = useCallback(
    async (
      authData: GoogleAuthData,
      options: { createIfMissing?: boolean } = {}
    ) => {
      const { createIfMissing = true } = options;
      const provider = createGoogleDriveProvider(authData.accessToken);
      const exists = await hasRemoteVault(provider);
      if (!exists && !createIfMissing) return 'missing' as const;
      await updateConfig({ ...authData, lastSyncTimestamp: undefined });
      setSyncError(null);
      setIsAuthExpired(false);
      let outcome: 'created' | 'needs-phrase' = 'needs-phrase';
      if (!exists) {
        try {
          await createVault(provider);
          outcome = 'created';
        } catch (err) {
          if (!(err instanceof VaultAlreadyExistsError)) throw err;
        }
      }
      setVaultState(outcome === 'created' ? 'unlocked' : 'locked');
      return outcome;
    },
    [updateConfig]
  );

  const unlockWithPhrase = useCallback(
    async (phrase: string) => {
      await withProvider((provider) => unlockVault(provider, phrase));
      setVaultState('unlocked');
      await syncNow();
    },
    [syncNow, withProvider]
  );

  const startOverWithNewPhrase = useCallback(async () => {
    await withProvider(async (provider) => {
      await deleteCloudData(provider);
      await createVault(provider);
    });
    setVaultState('unlocked');
  }, [withProvider]);

  const disconnect = useCallback(
    async (options?: { deleteCloudData?: boolean }) => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      if (options?.deleteCloudData && configRef.current)
        await withProvider((provider) => deleteCloudData(provider));
      else await forgetVaultKey();
      await updateConfig(null);
      setVaultState('disconnected');
      setSyncState('idle');
      setLastSyncedAt(null);
      setIsUpToDate(true);
      setSyncError(null);
      setIsAuthExpired(false);
    },
    [updateConfig, withProvider]
  );

  const restoreExcludedProfile = useCallback(
    async (patientId: string) => {
      const keys = await loadVaultKeys();
      if (!keys) throw new Error('Enter your recovery phrase first.');
      await withProvider((provider) =>
        restoreExcludedPatient(provider, keys, patientId)
      );
    },
    [withProvider]
  );

  const clearError = useCallback(() => {
    setSyncError(null);
    setSyncState('idle');
    setIsAuthExpired(false);
  }, []);

  return (
    <SyncContext.Provider
      value={{
        syncState,
        isSyncing: syncState === 'syncing',
        lastSyncedAt,
        isUpToDate,
        syncError,
        isAuthExpired,
        config,
        vaultState,
        syncNow,
        connectWithGoogle,
        unlockWithPhrase,
        startOverWithNewPhrase,
        disconnect,
        restoreExcludedProfile,
        clearError,
        refreshConfig,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return ctx;
}
