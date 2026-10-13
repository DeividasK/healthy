import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PlusCircleButton } from './PlusCircleButton';
import { COLORS } from '@/src/theme/colors';

export interface DockAction {
  label: string;
  testID: string;
  icon: LucideIcon;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  busy?: boolean;
  expanded?: boolean;
}

const motion = {
  duration: 240,
  easing: Easing.inOut(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};
export const getActionDockMenuOffset = (bottomInset: number) =>
  Math.max(bottomInset, 12) + 16 + 52 + 16;

/** One persistent island; its background and action positions adapt between screens. */
export function ActionDock({
  actions,
  enabled = true,
}: {
  actions: DockAction[];
  enabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const hasPrimary = actions.some((action) => action.primary);
  const onlyPrimary = hasPrimary && actions.length === 1;
  const rowWidth =
    actions.reduce((sum, action) => sum + (action.primary ? 52 : 44), 0) +
    Math.max(0, actions.length - 1) * 10;
  const primaryIndex = actions.findIndex((action) => action.primary);
  const primaryCenter =
    primaryIndex < 0
      ? rowWidth / 2
      : actions
          .slice(0, primaryIndex)
          .reduce((sum, action) => sum + (action.primary ? 52 : 44) + 10, 0) +
        26;
  // Keep the primary action at the island/screen center even with more actions on one side.
  const targetWidth = onlyPrimary
    ? 40
    : 2 * Math.max(primaryCenter, rowWidth - primaryCenter) + 20;
  const width = useSharedValue(targetWidth);
  const height = useSharedValue(onlyPrimary ? 40 : 52);
  const backgroundOpacity = useSharedValue(onlyPrimary ? 0 : 1);

  useEffect(() => {
    if (!actions.length) return;
    width.value = withTiming(targetWidth, motion);
    if (onlyPrimary) {
      backgroundOpacity.value = withTiming(0, motion, (finished) => {
        // Resize the hidden background only; the visible island stays level.
        if (finished) height.value = 40;
      });
    } else {
      height.value = 52;
      backgroundOpacity.value = withTiming(1, motion);
    }
  }, [
    actions.length,
    targetWidth,
    onlyPrimary,
    width,
    height,
    backgroundOpacity,
  ]);

  const backgroundStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: height.value,
    opacity: backgroundOpacity.value,
  }));
  const containerStyle = useAnimatedStyle(() => ({
    width: Math.max(width.value, 52),
  }));
  const positioned = actions.map((action, index) => {
    const size = action.primary ? 52 : 44;
    const precedingWidth = actions
      .slice(0, index)
      .reduce((sum, preceding) => sum + (preceding.primary ? 52 : 44) + 10, 0);
    const offset = -primaryCenter + precedingWidth + size / 2;
    return { action, offset };
  });
  const primary = positioned.find(({ action }) => action.primary);
  const secondary = positioned.filter(({ action }) => !action.primary);

  return (
    <View
      style={[
        styles.positioner,
        {
          bottom: Math.max(insets.bottom, 12) + 16,
          display: actions.length ? 'flex' : 'none',
        },
      ]}
    >
      <Animated.View
        testID="resource-action-dock"
        style={[styles.dock, containerStyle]}
        accessibilityRole="toolbar"
        accessibilityLabel="Screen actions"
      >
        <Animated.View
          testID="action-dock-background"
          style={[styles.background, backgroundStyle]}
        />
        <ActionSlot
          action={secondary[0]?.action}
          offset={secondary[0]?.offset ?? 0}
          enabled={enabled}
        />
        <ActionSlot
          action={primary?.action}
          offset={primary?.offset ?? 0}
          enabled={enabled}
        />
        <ActionSlot
          action={secondary[1]?.action}
          offset={secondary[1]?.offset ?? 0}
          enabled={enabled}
        />
        <ActionSlot
          action={secondary[2]?.action}
          offset={secondary[2]?.offset ?? 0}
          enabled={enabled}
        />
      </Animated.View>
    </View>
  );
}

function ActionSlot({
  action,
  offset,
  enabled,
}: {
  action?: DockAction;
  offset: number;
  enabled: boolean;
}) {
  const [lastAction, setLastAction] = React.useState(action);
  if (action && action !== lastAction) setLastAction(action);
  const displayedAction = action ?? lastAction;
  const size = displayedAction?.primary ? 52 : 44;
  const visible = Boolean(action);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, motion),
    transform: [
      { translateX: withTiming(offset, motion) },
      { scale: withTiming(visible ? 1 : 0, motion) },
    ],
  }));
  if (!displayedAction)
    return <Animated.View style={[styles.slot, animatedStyle]} />;
  const Icon = displayedAction.icon;
  const content = displayedAction.busy ? (
    <ActivityIndicator
      size="small"
      color={
        displayedAction.primary
          ? COLORS.light.primaryForeground
          : COLORS.light.primary
      }
    />
  ) : (
    <Icon
      color={
        displayedAction.primary && !displayedAction.expanded
          ? COLORS.light.primaryForeground
          : COLORS.light.iconMuted
      }
      size={displayedAction.primary ? 25 : 20}
    />
  );
  const props = {
    accessibilityRole: 'button' as const,
    accessibilityLabel: displayedAction.expanded
      ? 'Close add menu'
      : displayedAction.label,
    'aria-expanded': displayedAction.expanded,
    accessibilityState: {
      disabled: displayedAction.disabled || !visible || !enabled,
      busy: displayedAction.busy,
      expanded: displayedAction.expanded,
    },
    testID: action?.testID,
    disabled: displayedAction.disabled || !visible || !enabled,
    onPress: displayedAction.onPress,
    activeOpacity: 0.8,
  };
  return (
    <Animated.View
      testID={displayedAction.primary ? 'action-dock-primary-slot' : undefined}
      pointerEvents={visible && enabled ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible || !enabled}
      importantForAccessibility={
        visible && enabled ? 'auto' : 'no-hide-descendants'
      }
      aria-hidden={!visible || !enabled}
      style={[
        styles.slot,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
        },
        animatedStyle,
      ]}
    >
      {displayedAction.primary ? (
        <PlusCircleButton
          {...props}
          variant="primary"
          expanded={displayedAction.expanded}
          size={52}
          style={displayedAction.disabled ? styles.disabled : undefined}
        >
          {content}
        </PlusCircleButton>
      ) : (
        <TouchableOpacity
          {...props}
          style={[
            styles.actionButton,
            displayedAction.disabled && styles.disabled,
          ]}
        >
          {content}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    pointerEvents: 'box-none',
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dock: { height: 52, alignItems: 'center', justifyContent: 'center' },
  background: {
    pointerEvents: 'none',
    position: 'absolute',
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    borderRadius: 999,
    ...Platform.select({
      web: { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)' },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  slot: { position: 'absolute', left: '50%', top: '50%', zIndex: 1 },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
