import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

export interface PlusCircleButtonProps extends TouchableOpacityProps {
  size?: number;
  iconSize?: number;
  iconColor?: string;
  variant?: 'default' | 'primary';
  style?: StyleProp<ViewStyle>;
}

export function PlusCircleButton({
  size,
  iconSize,
  iconColor,
  variant = 'default',
  style,
  activeOpacity = 0.8,
  ...props
}: PlusCircleButtonProps) {
  const isPrimary = variant === 'primary';
  const defaultSize = isPrimary ? 56 : 36;
  const actualSize = size ?? defaultSize;
  const actualIconSize = iconSize ?? (isPrimary ? 26 : 18);
  const actualIconColor =
    iconColor ??
    (isPrimary ? COLORS.light.primaryForeground : COLORS.light.iconMuted);

  return (
    <TouchableOpacity
      activeOpacity={activeOpacity}
      style={[
        styles.button,
        isPrimary && styles.buttonPrimary,
        {
          width: actualSize,
          height: actualSize,
          borderRadius: actualSize / 2,
        },
        style,
      ]}
      {...props}
    >
      <Plus color={actualIconColor} size={actualIconSize} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(61, 100, 80, 0.35)',
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
});
