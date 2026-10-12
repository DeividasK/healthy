import React, { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { AppLogo } from './AppLogo';
import { SyncHeaderIndicator } from './SyncHeaderIndicator';
import { ProfileHeaderButton } from '@/src/features/profile/ProfileHeaderButton';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { patients } = useActivePatient();
  const isHome = pathname === '/';
  const showBack = !isHome && patients.length > 0;
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(isHome ? 0 : 1);

  useEffect(() => {
    progress.value = withTiming(isHome ? 0 : 1, {
      duration: 280,
      easing: Easing.inOut(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [isHome, progress]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * Math.max(0, width / 2 - 38) }],
    opacity: width > 0 ? 1 : 0,
  }));
  const backStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View
        testID="app-header"
        style={styles.header}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {showBack && (
          <Animated.View style={backStyle}>
            <TouchableOpacity
              testID="back-button"
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.button}
              onPress={() => {
                Keyboard.dismiss();
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              activeOpacity={0.7}
            >
              <ChevronLeft color={COLORS.light.primary} size={24} />
            </TouchableOpacity>
          </Animated.View>
        )}
        <Animated.View style={[styles.logo, logoStyle]}>
          <TouchableOpacity
            testID="app-home-button"
            accessibilityRole="button"
            accessibilityLabel="Home"
            style={styles.button}
            onPress={() => {
              Keyboard.dismiss();
              router.dismissTo('/');
            }}
            activeOpacity={0.8}
          >
            <AppLogo size={28} color={COLORS.light.primary} />
          </TouchableOpacity>
        </Animated.View>
        <View style={styles.profile}>
          <SyncHeaderIndicator />
          <View style={styles.button}>
            <ProfileHeaderButton />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.light.card },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.card,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { position: 'absolute', left: 16 },
  profile: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
