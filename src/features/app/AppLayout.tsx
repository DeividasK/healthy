import { useFonts } from 'expo-font';
import { Stack, ThemeProvider, useNavigationContainerRef } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';
import '../../../global.css';

import { AppChrome } from '@/src/components/AppChrome';
import { COLORS } from '@/src/theme/colors';
import { NAV_THEME } from '@/src/theme';
import { ActivePatientProvider } from '@/src/features/profile/ActivePatientContext';
import { SyncProvider } from '@/src/context/SyncContext';
import { DatabaseProvider } from '@/src/database/db';
import { ProfileDeletedRemotelyModal } from '@/src/features/sync/ProfileDeletedRemotelyModal';
import {
  setupTestBridge,
  useTestResetKey,
} from '@/src/features/testing/testBridge';
import { registerPwa } from './registerPwa';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppReadyHandler() {
  const navigation = useNavigationContainerRef();
  useEffect(() => {
    SplashScreen.hideAsync();
    setupTestBridge(navigation);
    registerPwa();
  }, [navigation]);

  return null;
}

export default function RootLayout() {
  // Tests reset the app in place; production never changes it.
  const resetKey = useTestResetKey();
  const [loaded, error] = useFonts({
    SpaceMono: require('../../../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  if (!loaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: COLORS.light.background,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <DatabaseProvider>
      <AppReadyHandler />
      <SyncProvider key={resetKey}>
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
  return (
    <ThemeProvider value={NAV_THEME.light}>
      <StatusBar style="dark" />
      <AppChrome>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
      </AppChrome>
      <ProfileDeletedRemotelyModal />
    </ThemeProvider>
  );
}
