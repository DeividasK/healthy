import React from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A full-width labelled button for onboarding, where a first-time user needs
 * words rather than the dock's icon-only actions. `link` is the quiet
 * secondary choice beneath it.
 */
export function OnboardingButton({
  label,
  onPress,
  icon: Icon,
  variant = 'primary',
  disabled = false,
  done = false,
  doneIcon: DoneIcon,
  testID,
}: {
  label: string;
  onPress: () => void;
  /** Trailing icon, e.g. an arrow on "Get started". */
  icon?: LucideIcon;
  variant?: 'primary' | 'link';
  disabled?: boolean;
  /** Shows `doneIcon` in place of the label, e.g. a tick once saved. */
  done?: boolean;
  doneIcon?: LucideIcon;
  testID?: string;
}) {
  const primary = variant === 'primary';
  const foreground = primary
    ? COLORS.light.primaryForeground
    : COLORS.light.primary;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: done }}
      disabled={disabled || done}
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.button,
        primary ? styles.primary : styles.link,
        disabled && styles.disabled,
      ]}
    >
      {done ? (
        DoneIcon ? (
          <DoneIcon size={24} color={foreground} strokeWidth={2.5} />
        ) : (
          <ActivityIndicator color={foreground} />
        )
      ) : (
        <View style={styles.content}>
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
          {Icon && <Icon size={20} color={foreground} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'stretch',
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    height: 52,
    backgroundColor: COLORS.light.primary,
    ...Platform.select({
      web: { boxShadow: '0 4px 14px rgba(61, 100, 80, 0.35)' },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 14,
        elevation: 4,
      },
    }),
  },
  link: {
    height: 44,
  },
  disabled: {
    opacity: 0.45,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
