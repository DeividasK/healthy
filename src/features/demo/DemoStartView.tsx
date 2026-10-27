import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { AppLogo } from '@/src/components/AppLogo';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { useActionDock } from '@/src/components/AppChrome';
import type { DockAction } from '@/src/components/ActionDock';
import { COLORS } from '@/src/theme/colors';
import { useLoadDemoProfile } from './useLoadDemoProfile';

const NO_ACTIONS: DockAction[] = [];

/**
 * The demo build's first screen in place of Welcome: it adds the demo profile
 * and opens its Home, offering a retry if that fails.
 */
export function DemoStartView() {
  const { loadDemo, error } = useLoadDemoProfile();
  const actions = useMemo<DockAction[]>(
    () =>
      error
        ? [
            {
              label: 'Retry',
              testID: 'demo-start-retry',
              icon: RefreshCw,
              onPress: loadDemo,
              primary: true,
            },
          ]
        : NO_ACTIONS,
    [error, loadDemo]
  );
  useActionDock(actions);

  useEffect(() => {
    void loadDemo();
    // Loads once when the demo opens; retries come from the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container} testID="demo-start">
      <AppLogo size={56} color={COLORS.light.primary} />
      <Text accessibilityRole="header" style={styles.title}>
        Opening the demo profile
      </Text>
      {error ? (
        <FormErrorBanner message={error} testID="demo-start-error" />
      ) : (
        <ActivityIndicator color={COLORS.light.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    padding: 28,
    backgroundColor: COLORS.light.background,
  },
  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
    color: COLORS.light.foreground,
    textAlign: 'center',
  },
});
