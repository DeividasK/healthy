import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A compact primary-coloured text button with a leading icon.
 */
export function IconTextButton({
  icon: Icon,
  label,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon size={16} color={COLORS.light.primary} />
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primary,
  },
});
