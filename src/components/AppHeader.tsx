import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Settings } from 'lucide-react-native';
import { AppLogo } from './AppLogo';
import { OfflineHeaderIndicator, useIsOffline } from './OfflineHeaderIndicator';
import { SyncHeaderIndicator } from './SyncHeaderIndicator';
import { ProfileHeaderButton } from '@/src/features/profile/ProfileHeaderButton';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import {
  takeHeroLogoRect,
  takeLogoBeat,
} from '@/src/features/onboarding/logoHandoff';
import { HEARTBEAT, pop } from '@/src/features/onboarding/motion';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN } from '@/src/theme/layout';

/**
 * The header logo. Welcome shows its own large heart, so the logo hides
 * there; on the next step it starts where that heart was and flies home.
 * Arriving at Home after setup, it beats once.
 */
function HeaderLogo({ pathname }: { pathname: string }) {
  const reduceMotion = useReducedMotion();
  const logoRef = useRef<View>(null);
  const opacity = useSharedValue(pathname === '/welcome' ? 0 : 1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const beat = useSharedValue(1);

  useEffect(() => {
    if (pathname === '/welcome') {
      opacity.value = 0;
      return;
    }
    const hero = pathname === '/welcome/name' ? takeHeroLogoRect() : null;
    if (!hero || reduceMotion || !logoRef.current) {
      opacity.value = 1;
    } else {
      logoRef.current.measureInWindow((x, y, width, height) => {
        if (width > 0) {
          const motion = { duration: 560, easing: Easing.out(Easing.cubic) };
          translateX.value = hero.x + hero.width / 2 - (x + width / 2);
          translateY.value = hero.y + hero.height / 2 - (y + height / 2);
          scale.value = hero.width / width;
          translateX.value = withTiming(0, motion);
          translateY.value = withTiming(0, motion);
          scale.value = withTiming(1, motion);
        }
        opacity.value = 1;
      });
    }
    if (pathname === '/' && takeLogoBeat() && !reduceMotion) {
      beat.value = withDelay(
        80,
        withSequence(
          ...HEARTBEAT.map(({ scale: to, duration }) =>
            withTiming(to, { duration, easing: Easing.inOut(Easing.ease) })
          )
        )
      );
    }
  }, [pathname, reduceMotion, opacity, translateX, translateY, scale, beat]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value * beat.value },
    ],
  }));

  return (
    <Animated.View ref={logoRef} collapsable={false} style={style}>
      <AppLogo size={28} color={COLORS.light.primary} />
    </Animated.View>
  );
}

/** Profile on the left, the logo (home) centred, sync status and settings on the right. */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isOffline = useIsOffline();
  // The profile and its settings show once a profile exists.
  const { activePatient, isLoading } = useActivePatient();
  // They pop in when a profile follows a loaded "no profile", i.e. the first
  // one is created, not on every start while the profile loads.
  const [sawNoProfile, setSawNoProfile] = useState(false);
  if (!isLoading && !activePatient && !sawNoProfile) setSawNoProfile(true);
  const popIn = Boolean(activePatient) && sawNoProfile;
  const onWelcome = pathname === '/welcome';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View testID="app-header" style={styles.header}>
        <View style={styles.logo}>
          <TouchableOpacity
            testID="app-home-button"
            accessibilityRole="button"
            accessibilityLabel="Home"
            accessibilityElementsHidden={onWelcome}
            importantForAccessibility={
              onWelcome ? 'no-hide-descendants' : 'auto'
            }
            disabled={onWelcome}
            style={styles.button}
            onPress={() => {
              Keyboard.dismiss();
              router.dismissTo('/');
            }}
            activeOpacity={0.8}
          >
            <HeaderLogo pathname={pathname} />
          </TouchableOpacity>
        </View>
        {activePatient && (
          <Animated.View
            entering={popIn ? pop(240) : undefined}
            style={styles.button}
          >
            <ProfileHeaderButton />
          </Animated.View>
        )}
        <View style={styles.end}>
          {isOffline ? <OfflineHeaderIndicator /> : <SyncHeaderIndicator />}
          {activePatient && (
            <Animated.View entering={popIn ? pop(240) : undefined}>
              <TouchableOpacity
                testID="settings-header-button"
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={styles.button}
                activeOpacity={0.7}
                onPress={() => {
                  Keyboard.dismiss();
                  if (pathname !== '/settings') router.navigate('/settings');
                }}
              >
                <Settings size={22} color={COLORS.light.primary} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // The divider spans the window; the header row lines up with the content.
  safeArea: {
    backgroundColor: COLORS.light.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  header: {
    ...CONTENT_COLUMN,
    height: 64 - StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.light.card,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Centred on the whole header, whatever sits at either end.
  logo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Taps beside the logo reach the buttons at either end.
    pointerEvents: 'box-none',
  },
  end: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
