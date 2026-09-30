import { useFonts } from 'expo-font';
import { Link, Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import 'react-native-reanimated';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LabReportsProvider } from '../src/context/LabReportsContext';
import { UserProfileProvider } from '../src/context/UserProfileContext';
import { initI18n } from '../src/i18n/i18n';
import { useTranslation } from 'react-i18next';
import { AppLogo } from '../src/components/AppLogo';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    if (loaded) {
      initI18n().then(() => setI18nReady(true));
    }
  }, [loaded]);

  useEffect(() => {
    if (loaded && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nReady]);

  if (!loaded || !i18nReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <UserProfileProvider>
      <LabReportsProvider>
        <RootLayoutNavContent />
      </LabReportsProvider>
    </UserProfileProvider>
  );
}

function RootLayoutNavContent() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="index"
          options={{
            title: '',
            headerLeft: () => (
              <View style={{ marginLeft: Platform.OS === 'ios' ? 0 : 4 }}>
                <AppLogo
                  size={30}
                  color={colorScheme === 'dark' ? '#98CEAA' : '#5A8669'}
                />
              </View>
            ),
            headerRight: () => (
              <View
                style={{
                  marginRight: Platform.OS === 'ios' ? 0 : 4,
                }}
              >
                <Link href="/profile" asChild>
                  <Pressable hitSlop={8}>
                    {({ pressed }) => (
                      <SymbolView
                        name={{
                          ios: 'person.crop.circle',
                          android: 'person',
                          web: 'person',
                        }}
                        size={25}
                        tintColor={Colors[colorScheme].text}
                        style={{ opacity: pressed ? 0.5 : 1 }}
                      />
                    )}
                  </Pressable>
                </Link>
              </View>
            ),
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            title: t('profile.screenTitle', 'Profile'),
            headerBackTitle: t('tabs.home', 'Home'),
          }}
        />
        <Stack.Screen
          name="add-report"
          options={{
            presentation: 'modal',
            title: t('addReport.screenTitle'),
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="report/[id]"
          options={{
            title: t('reportDetail.screenTitle'),
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="modal"
          options={{
            presentation: 'modal',
            title: t('modal.title'),
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
