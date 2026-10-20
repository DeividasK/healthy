import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A profile's patient ID, selectable so it can be copied. It tells apart
 * profiles that share a name.
 */
export function PatientIdText({
  id,
  testID,
  style,
}: {
  id: string;
  testID?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text selectable style={[styles.id, style]} testID={testID}>
      {id}
    </Text>
  );
}

const styles = StyleSheet.create({
  id: {
    fontSize: 12,
    color: COLORS.light.textSecondary,
  },
});
