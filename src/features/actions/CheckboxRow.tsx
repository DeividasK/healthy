import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/** A checkbox labelled by text, or by an icon with `label` read aloud. */
export function CheckboxRow({
  label,
  icon: Icon,
  checked,
  disabled = false,
  onChange,
  testID,
}: {
  label: string;
  /** Shown instead of the label's text. */
  icon?: LucideIcon;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      aria-checked={checked}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      style={[styles.row, disabled && styles.disabled]}
      activeOpacity={0.6}
      onPress={() => onChange(!checked)}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && (
          <Check
            color={COLORS.light.primaryForeground}
            size={14}
            strokeWidth={3}
          />
        )}
      </View>
      {Icon ? (
        <Icon color={COLORS.light.iconMuted} size={18} />
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    alignSelf: 'flex-start',
  },
  disabled: {
    opacity: 0.5,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  label: {
    fontSize: 14,
    color: COLORS.light.foreground,
  },
});
