import { useFonts } from 'expo-font';
import { Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import 'react-native-reanimated';
import '../global.css';

import { AppLogo } from '../src/components/AppLogo';
import { COLORS } from '../src/theme/colors';
import { NAV_THEME } from '../src/theme';
import { ActivePatientProvider } from '../src/features/profile/ActivePatientContext';
import { ProfileHeaderButton } from '../src/features/profile/ProfileHeaderButton';
import { SyncProvider } from '../src/context/SyncContext';
import { SyncHeaderIndicator } from '../src/components/SyncHeaderIndicator';
import { initializeDatabase } from '../src/database/db';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [dbReady, setDbReady] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    let isMounted = true;
    initializeDatabase()
      .then(() => {
        if (isMounted) setDbReady(true);
      })
      .catch((err) => {
        console.error('Failed to initialize database in RootLayout:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const isReady = loaded && dbReady;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-app-ready', 'true');
      }
    }
  }, [isReady]);

  if (!isReady) {
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
    <SyncProvider>
      <ActivePatientProvider>
        <RootLayoutNav />
      </ActivePatientProvider>
    </SyncProvider>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={NAV_THEME.light}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: '',
            headerLeft: () => (
              <View style={{ marginLeft: 16 }}>
                <AppLogo size={30} color={COLORS.light.primaryLogo} />
              </View>
            ),
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SyncHeaderIndicator />
                <ProfileHeaderButton />
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="profile/index"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="profile/new"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
        <Stack.Screen
          name="profile/restore-from-file"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
        <Stack.Screen
          name="profile/restore-from-google-drive"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation: Platform.OS === 'web' ? 'none' : 'default',
          }}
        />
        <Stack.Screen
          name="profile/[id]/edit"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="add-report"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="lab-result/add"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="lab-result/[id]/edit"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="condition/add"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen
          name="condition/[id]/edit"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
