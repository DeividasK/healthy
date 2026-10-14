import React, { useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  TouchableOpacityProps,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { COLORS } from '@/src/theme/colors';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

export interface PlusCircleButtonProps extends TouchableOpacityProps {
  size?: number;
  iconSize?: number;
  iconColor?: string;
  variant?: 'default' | 'primary';
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PlusCircleButton({
  size,
  iconSize,
  iconColor,
  variant = 'default',
  expanded = false,
  style,
  activeOpacity = 0.8,
  children,
  ...props
}: PlusCircleButtonProps) {
  const isPrimary = variant === 'primary';
  const progress = useSharedValue(expanded ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(expanded ? 1 : 0, {
      duration: 200,
      reduceMotion: ReduceMotion.System,
    });
  }, [expanded, progress]);
  const buttonStyle = useAnimatedStyle(() => ({
    // An expanded primary becomes a close button the size of a secondary
    // action (44pt), so it stays inside the island instead of overlapping it.
    transform: [{ scale: isPrimary ? 1 - (8 / 52) * progress.value : 1 }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [isPrimary ? COLORS.light.primary : COLORS.light.card, COLORS.light.card]
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [
        isPrimary ? COLORS.light.primary : COLORS.light.pillBorder,
        COLORS.light.pillBorder,
      ]
    ),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 45}deg` }],
  }));
  const defaultSize = isPrimary ? 56 : 36;
  const actualSize = size ?? defaultSize;
  const actualIconSize = iconSize ?? (isPrimary ? 26 : 18);
  const actualIconColor =
    iconColor ??
    (isPrimary && !expanded
      ? COLORS.light.primaryForeground
      : COLORS.light.iconMuted);

  return (
    <AnimatedTouchableOpacity
      activeOpacity={activeOpacity}
      style={[
        styles.button,
        isPrimary && styles.buttonPrimary,
        expanded && styles.buttonSecondary,
        {
          width: actualSize,
          height: actualSize,
          borderRadius: actualSize / 2,
        },
        style,
        buttonStyle,
      ]}
      {...props}
    >
      <Animated.View
        testID={props.testID ? `${props.testID}-icon` : undefined}
        style={iconStyle}
      >
        {children ?? <Plus color={actualIconColor} size={actualIconSize} />}
      </Animated.View>
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonSecondary: {
    borderWidth: 0,
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowOpacity: 0, elevation: 0 },
    }),
  },
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
