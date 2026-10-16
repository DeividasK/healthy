import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';

/** A form-level error shown above the fields. */
export function FormErrorBanner({
  message,
  testID,
}: {
  message: string;
  testID?: string;
}) {
  return (
    <View style={styles.banner} testID={testID} accessibilityRole="alert">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.light.badgeHighBg,
    borderWidth: 1,
    borderColor: COLORS.light.badgeHighBorder,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  text: {
    color: COLORS.light.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
});
