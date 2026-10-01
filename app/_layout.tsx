import { useFonts } from 'expo-font';
import { Stack, ThemeProvider, DarkTheme, DefaultTheme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { AppLogo } from '../src/components/AppLogo';

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

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

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
          }}
        />
        <Stack.Screen
          name="add-report"
          options={{
            headerShown: false,
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
