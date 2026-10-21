import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';

/** Loads that finish sooner never show a loading indicator. */
export const LOADING_INDICATOR_DELAY_MS = 300;

/** Becomes true once `delayMs` has passed since the component mounted. */
export function useDelayedVisibility(
  delayMs = LOADING_INDICATOR_DELAY_MS
): boolean {
  const [visible, setVisible] = useState(delayMs <= 0);
  useEffect(() => {
    if (delayMs <= 0) return;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);
  return visible;
}

/**
 * Fills a screen whose data is loading. The spinner appears only once the
 * load takes noticeably long, so quick screens open without a flash.
 */
export function LoadingView() {
  const visible = useDelayedVisibility();
  return (
    <View testID="loading-view" style={styles.container}>
      {visible && (
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
});
