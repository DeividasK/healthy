import React from 'react';
import { Keyboard, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppLogo } from './AppLogo';
import { SyncHeaderIndicator } from './SyncHeaderIndicator';
import { ProfileHeaderButton } from '@/src/features/profile/ProfileHeaderButton';
import { COLORS } from '@/src/theme/colors';

export function AppHeader() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View testID="app-header" style={styles.header}>
        <View style={styles.logo}>
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
        </View>
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
