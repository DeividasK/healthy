import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { COLORS } from '@/src/theme/colors';

export function ScreenHeading({
  children,
  testID,
}: {
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Text accessibilityRole="header" testID={testID} style={styles.title}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 24,
  },
});
