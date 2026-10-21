import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  Archive,
  ArrowRight,
  KeyRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { AppLogo } from '@/src/components/AppLogo';
import { IconDisc } from '@/src/components/IconDisc';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { OnboardingButton } from './OnboardingButton';
import { setHeroLogoRect } from './logoHandoff';
import { HEARTBEAT, pop, rise } from './motion';

const HERO_SIZE = 88;

const TRUST_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: ShieldCheck,
    title: 'Private by design',
    body: 'Your records stay on this device. No account needed.',
  },
  {
    icon: KeyRound,
    title: 'Backup only you can unlock',
    body: 'Optional encrypted backup to your own Google Drive.',
  },
  {
    icon: Archive,
    title: 'Yours to take anywhere',
    body: 'Export in standard medical formats whenever you like.',
  },
];

/** The heart grows in, then beats three times. */
function HeroHeart({ heartRef }: { heartRef: React.RefObject<View | null> }) {
  const reduceMotion = useReducedMotion();
  const grow = useSharedValue(reduceMotion ? 1 : 0);
  const beat = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    grow.value = withTiming(1, {
      duration: 760,
      easing: Easing.out(Easing.back(1.6)),
    });
    beat.value = withDelay(
      720,
      withRepeat(
        withSequence(
          ...HEARTBEAT.map(({ scale, duration }) =>
            withTiming(scale, { duration, easing: Easing.inOut(Easing.ease) })
          )
        ),
        3
      )
    );
  }, [reduceMotion, grow, beat]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: grow.value * beat.value }],
  }));

  return (
    <Animated.View
      ref={heartRef}
      collapsable={false}
      style={[styles.hero, style]}
      testID="welcome-heart"
    >
      <AppLogo
        size={HERO_SIZE}
        color={COLORS.light.primary}
        accessibilityLabel="Healthy"
      />
    </Animated.View>
  );
}

/** First-run introduction: what Healthy is and why it can be trusted. */
export function WelcomeView() {
  const router = useRouter();
  const { patients } = useActivePatient();
  const heartRef = useRef<View>(null);

  // Welcome is for a device with no profile yet.
  if (patients.length > 0) return <Redirect href="/" />;

  const getStarted = () => {
    const heart = heartRef.current;
    if (heart) {
      heart.measureInWindow((x, y, width, height) => {
        if (width > 0) setHeroLogoRect({ x, y, width, height });
        router.push('/welcome/name');
      });
    } else {
      router.push('/welcome/name');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        testID="welcome-view"
      >
        <HeroHeart heartRef={heartRef} />
        <Animated.Text
          entering={rise(320)}
          accessibilityRole="header"
          style={styles.title}
          testID="welcome-title"
        >
          Healthy
        </Animated.Text>
        <Animated.Text entering={rise(400)} style={styles.subtitle}>
          See your whole health story in one place.
        </Animated.Text>
        <View style={styles.points}>
          {TRUST_POINTS.map(({ icon, title, body }, index) => (
            <View key={title} style={styles.point}>
              <Animated.View entering={pop(560 + index * 80)}>
                <IconDisc icon={icon} />
              </Animated.View>
              <Animated.View
                entering={rise(560 + index * 80)}
                style={styles.pointText}
              >
                <Text style={styles.pointTitle}>{title}</Text>
                <Text style={styles.pointBody}>{body}</Text>
              </Animated.View>
            </View>
          ))}
        </View>
        <Animated.View entering={rise(880)} style={styles.actions}>
          <OnboardingButton
            label="Get started"
            icon={ArrowRight}
            onPress={getStarted}
            testID="welcome-get-started"
          />
          <OnboardingButton
            label="I already use Healthy"
            variant="link"
            onPress={() => router.push('/profile/restore')}
            testID="welcome-restore"
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 84,
    paddingBottom: 28,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  hero: {
    width: HERO_SIZE,
    height: HERO_SIZE,
    alignSelf: 'center',
  },
  title: {
    marginTop: 28,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: COLORS.light.foreground,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.textSecondary,
    textAlign: 'center',
  },
  points: {
    marginTop: 36,
    gap: 18,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  pointBody: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 32,
    gap: 10,
  },
});
