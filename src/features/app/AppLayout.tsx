import { Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import '../../../global.css';

import { AppChrome } from '@/src/components/AppChrome';
import { NAV_THEME } from '@/src/theme';
import {
  ActivePatientProvider,
  useActivePatient,
} from '@/src/features/profile/ActivePatientContext';
import { ResourceSkeleton } from '@/src/components/ResourceSkeleton';
import { SyncProvider } from '@/src/context/SyncContext';
import { DatabaseProvider } from '@/src/database/db';
import { ProfileDeletedRemotelyModal } from '@/src/features/sync/ProfileDeletedRemotelyModal';
import { setupTestBridge } from '@/src/features/testing/testBridge';
import { registerPwa } from './registerPwa';

// Keep the splash screen up until the app chrome has rendered, then fade out
// to it: placeholders show while the database opens and data arrives.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true });

function AppReadyHandler() {
  useEffect(() => {
    SplashScreen.hide();
    setupTestBridge();
    registerPwa();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <AppReadyHandler />
      <SyncProvider>
        <ActivePatientProvider>
          <RootLayoutNav />
        </ActivePatientProvider>
      </SyncProvider>
    </DatabaseProvider>
  );
}

/**
 * Releases focus before a screen change hides the current screen (web).
 * Otherwise the focused button ends up inside an `aria-hidden` screen, which
 * browsers block with a warning. Parameter changes keep the same screen, so
 * keyboard focus stays where it is for them.
 */
function useBlurOnScreenChange() {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    return navigation.addListener('__unsafe_action__', ({ data }) => {
      if (data.noop || data.action.type === 'SET_PARAMS') return;
      (document.activeElement as HTMLElement | null)?.blur?.();
    });
  }, [navigation]);
}

function RootLayoutNav() {
  useBlurOnScreenChange();
  // Screens mount once the database is open and the active profile is known,
  // so nothing can be read or saved without it. The header shows meanwhile.
  const { isLoading } = useActivePatient();
  return (
    <ThemeProvider value={NAV_THEME.light}>
      <StatusBar style="dark" />
      <AppChrome>
        {isLoading ? (
          <ResourceSkeleton testID="app-loading-skeleton" />
        ) : (
          <Stack
            screenOptions={{
              headerShown: false,
              animation: Platform.OS === 'web' ? 'none' : 'default',
            }}
          />
        )}
      </AppChrome>
      <ProfileDeletedRemotelyModal />
    </ThemeProvider>
  );
}
