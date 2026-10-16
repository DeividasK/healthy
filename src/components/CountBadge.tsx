import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '@/src/theme/colors';

/** Total items in a list, independent of how many are currently visible. */
export function CountBadge({
  count,
  accessibilityLabel,
  testID,
}: {
  count: number;
  accessibilityLabel: string;
  testID?: string;
}) {
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={styles.badge}
    >
      {count}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 24,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    overflow: 'hidden',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
    backgroundColor: COLORS.light.pillBackground,
  },
});
