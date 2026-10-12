import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
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
import { setupTestBridge } from '@/src/features/testing/testBridge';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppReadyHandler() {
  useEffect(() => {
    SplashScreen.hideAsync();
    setupTestBridge();
  }, []);

  return null;
}

export default function RootLayout() {
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
      <SyncProvider>
        <ActivePatientProvider>
          <RootLayoutNav />
        </ActivePatientProvider>
      </SyncProvider>
    </DatabaseProvider>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={NAV_THEME.light}>
      <AppChrome>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
      </AppChrome>
    </ThemeProvider>
  );
}
