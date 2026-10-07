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
  GoogleDriveConfig,
  loadGoogleDriveConfig,
  saveGoogleDriveConfig,
  syncWithGoogleDrive,
  refreshGoogleAccessToken,
} from '../services/syncManager';
import { fetchAllStoredPatients } from '../features/profile/patientRepository';

export type SyncState = 'idle' | 'syncing' | 'just_synced' | 'error';

interface SyncContextValue {
  syncState: SyncState;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isUpToDate: boolean;
  syncError: string | null;
  isAuthExpired: boolean;
  config: GoogleDriveConfig | null;
  syncNow: () => Promise<void>;
  connectWithGoogle: (authData: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: number;
    userSub: string;
    userEmail?: string;
    userName?: string;
  }) => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
  refreshConfig: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GoogleDriveConfig | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isUpToDate, setIsUpToDate] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isAuthExpired, setIsAuthExpired] = useState<boolean>(false);

  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightSyncRef = useRef<Promise<void> | null>(null);
  const lastFocusSyncRef = useRef<number>(0);

  const refreshConfig = useCallback(async () => {
    try {
      const loaded = await loadGoogleDriveConfig();
      setConfig(loaded);
      if (loaded?.lastSyncTimestamp) {
        setLastSyncedAt(new Date(loaded.lastSyncTimestamp));
        setIsUpToDate(true);
      }
    } catch (err) {
      console.warn('Failed to refresh sync config:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const loaded = await loadGoogleDriveConfig();
        if (!isMounted) return;
        setConfig(loaded);
        if (loaded?.lastSyncTimestamp) {
          setLastSyncedAt(new Date(loaded.lastSyncTimestamp));
          setIsUpToDate(true);
        } else if (loaded) {
          setIsUpToDate(false);
        }
      } catch (err) {
        console.warn('Failed to load sync config:', err);
      }
    })();

    return () => {
      isMounted = false;
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!config) return;
    if (inFlightSyncRef.current) {
      return inFlightSyncRef.current;
    }

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    setSyncState('syncing');
    setSyncError(null);
    setIsAuthExpired(false);

    const performSync = async () => {
      try {
        let activeConfig = config;

        // 1. If refresh token is available and token has expired or is nearing expiry, refresh preemptively
        const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
        if (
          activeConfig.refreshToken &&
          activeConfig.tokenExpiresAt &&
          Date.now() >= activeConfig.tokenExpiresAt - 60000 &&
          clientId
        ) {
          try {
            const refreshRes = await refreshGoogleAccessToken(
              activeConfig.refreshToken,
              clientId
            );
            activeConfig = {
              ...activeConfig,
              accessToken: refreshRes.accessToken,
              tokenExpiresAt: refreshRes.expiresIn
                ? Date.now() + refreshRes.expiresIn * 1000
                : undefined,
            };
            await saveGoogleDriveConfig(activeConfig);
            setConfig(activeConfig);
          } catch (refreshErr) {
            console.warn('Preemptive token refresh failed:', refreshErr);
          }
        }

        try {
          await syncWithGoogleDrive(activeConfig);
        } catch (firstErr: unknown) {
          const isAuthError =
            (firstErr instanceof Error &&
              (firstErr.name === 'GoogleAuthExpiredError' ||
                firstErr.message.includes('HTTP 401') ||
                firstErr.message.includes('Invalid Credentials') ||
                firstErr.message.includes('UNAUTHENTICATED'))) ||
            false;

          // If auth error and we have a refreshToken, attempt one refresh & retry
          if (isAuthError && activeConfig.refreshToken && clientId) {
            const refreshRes = await refreshGoogleAccessToken(
              activeConfig.refreshToken,
              clientId
            );
            activeConfig = {
              ...activeConfig,
              accessToken: refreshRes.accessToken,
              tokenExpiresAt: refreshRes.expiresIn
                ? Date.now() + refreshRes.expiresIn * 1000
                : undefined,
            };
            await saveGoogleDriveConfig(activeConfig);
            setConfig(activeConfig);
            // Retry sync with new token
            await syncWithGoogleDrive(activeConfig);
          } else {
            throw firstErr;
          }
        }

        const now = new Date();
        setLastSyncedAt(now);
        setIsUpToDate(true);
        setSyncState('just_synced');
        setIsAuthExpired(false);

        // Revert from 'just_synced' checkmark to 'idle' after 1 second
        resetTimerRef.current = setTimeout(() => {
          setSyncState('idle');
        }, 1000);

        // Refresh config to pick up new timestamp
        await refreshConfig();
      } catch (err: unknown) {
        const isAuthError =
          (err instanceof Error &&
            (err.name === 'GoogleAuthExpiredError' ||
              err.message.includes('HTTP 401') ||
              err.message.includes('Invalid Credentials') ||
              err.message.includes('UNAUTHENTICATED'))) ||
          false;

        const message = isAuthError
          ? 'Your Google Drive session has expired. Please reconnect to resume cloud backup.'
          : err instanceof Error
            ? err.message
            : 'Failed to sync with Google Drive.';

        console.error('Sync failed:', err);
        setSyncError(message);
        setIsAuthExpired(isAuthError);
        setIsUpToDate(false);
        setSyncState('error');
      } finally {
        inFlightSyncRef.current = null;
      }
    };

    inFlightSyncRef.current = performSync();
    return inFlightSyncRef.current;
  }, [config, refreshConfig]);

  // 15s poll for changes to cloud data when a profile is connected to Google Drive
  useEffect(() => {
    if (!config || isAuthExpired) return;

    const interval = setInterval(async () => {
      try {
        if (inFlightSyncRef.current) return;
        const stored = await fetchAllStoredPatients();
        const hasConnectedProfile = stored.some(
          (sp) => sp.syncAccount && sp.syncAccount === config.userSub
        );
        if (hasConnectedProfile) {
          await syncNow();
        }
      } catch (pollErr) {
        console.warn('15s cloud poll encountered an error:', pollErr);
      }
    }, 15000);

    return () => {
      clearInterval(interval);
    };
  }, [config, isAuthExpired, syncNow]);

  // Sync when webpage gets focus or application wakes up (browser tab switch, window focus, app resume)
  useEffect(() => {
    if (!config || isAuthExpired) return;

    const handleWakeup = async () => {
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 2000) return; // 2s debounce
      if (inFlightSyncRef.current) return;

      try {
        const stored = await fetchAllStoredPatients();
        const hasConnectedProfile = stored.some(
          (sp) => sp.syncAccount && sp.syncAccount === config.userSub
        );
        if (hasConnectedProfile) {
          lastFocusSyncRef.current = now;
          await syncNow();
        }
      } catch (err) {
        console.warn('Wakeup sync check encountered an error:', err);
      }
    };

    const onVisibilityChange = () => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        handleWakeup();
      }
    };

    const onWindowFocus = () => {
      handleWakeup();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', onWindowFocus);
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'active') {
          handleWakeup();
        }
      }
    );

    return () => {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', onWindowFocus);
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      appStateSub.remove();
    };
  }, [config, isAuthExpired, syncNow]);

  const connectWithGoogle = useCallback(
    async (authData: {
      accessToken: string;
      refreshToken?: string;
      tokenExpiresAt?: number;
      userSub: string;
      userEmail?: string;
      userName?: string;
    }) => {
      const newConfig: GoogleDriveConfig = {
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken,
        tokenExpiresAt: authData.tokenExpiresAt,
        userSub: authData.userSub,
        userEmail: authData.userEmail,
        userName: authData.userName,
        lastSyncTimestamp: undefined,
      };
      await saveGoogleDriveConfig(newConfig);
      setConfig(newConfig);
      setSyncError(null);
      setIsAuthExpired(false);
      setSyncState('syncing');
      // Trigger immediate initial sync
      setTimeout(() => {
        syncWithGoogleDrive(newConfig)
          .then(() => {
            setLastSyncedAt(new Date());
            setIsUpToDate(true);
            setSyncState('just_synced');
            resetTimerRef.current = setTimeout(() => {
              setSyncState('idle');
            }, 1000);
            refreshConfig();
          })
          .catch((err) => {
            setSyncError(
              err instanceof Error ? err.message : 'Initial sync failed.'
            );
            setSyncState('error');
          });
      }, 100);
    },
    [refreshConfig]
  );

  const disconnect = useCallback(async () => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
    }
    await saveGoogleDriveConfig(null);
    setConfig(null);
    setSyncState('idle');
    setLastSyncedAt(null);
    setIsUpToDate(true);
    setSyncError(null);
    setIsAuthExpired(false);
  }, []);

  const clearError = useCallback(() => {
    setSyncError(null);
    setSyncState('idle');
    setIsAuthExpired(false);
  }, []);

  const triggerSync = useCallback(async () => {
    // If not connected, mark as not up to date so when connected it prompts sync
    if (!config) {
      setIsUpToDate(false);
      return;
    }
    await syncNow();
  }, [config, syncNow]);

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
        syncNow,
        connectWithGoogle,
        disconnect,
        clearError,
        refreshConfig,
        triggerSync,
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
