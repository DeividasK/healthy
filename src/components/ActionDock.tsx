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

const GAP = 10;
const actionSize = (action: DockAction) => (action.primary ? 52 : 44);

/** Row geometry: the primary action sits at the screen center (offset 0). */
export function getActionDockLayout(actions: DockAction[]) {
  const rowWidth =
    actions.reduce((sum, action) => sum + actionSize(action), 0) +
    Math.max(0, actions.length - 1) * GAP;
  const primaryIndex = actions.findIndex((action) => action.primary);
  const primaryCenter =
    primaryIndex < 0
      ? rowWidth / 2
      : actions
          .slice(0, primaryIndex)
          .reduce((sum, action) => sum + actionSize(action) + GAP, 0) + 26;
  const offsets = actions.map(
    (action, index) =>
      -primaryCenter +
      actions
        .slice(0, index)
        .reduce((sum, preceding) => sum + actionSize(preceding) + GAP, 0) +
      actionSize(action) / 2
  );
  return { rowWidth, primaryIndex, primaryCenter, offsets };
}

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
  const { rowWidth, primaryIndex, primaryCenter, offsets } =
    getActionDockLayout(actions);
  // The island only spans its actions; the primary action stays at the
  // screen center, so the island may extend further to one side. A primary
  // action at either end fills the island's rounded end, so that end gets
  // no padding.
  const startPad = actions[0]?.primary ? 0 : 10;
  const endPad = actions[actions.length - 1]?.primary ? 0 : 10;
  const targetWidth = onlyPrimary ? 40 : rowWidth + startPad + endPad;
  const targetShift = onlyPrimary
    ? 0
    : (rowWidth + endPad - startPad) / 2 - primaryCenter;
  const primaryAction = actions[primaryIndex];
  const primaryPressRef = React.useRef<(() => void) | null>(null);
  const primaryPress =
    enabled && primaryAction && !primaryAction.disabled
      ? primaryAction.onPress
      : null;
  useEffect(() => {
    primaryPressRef.current = primaryPress;
  }, [primaryPress]);

  // Cmd/Ctrl+Enter runs the island's primary action on web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
      // Enter that confirms an IME composition is not a shortcut.
      if (event.isComposing) return;
      if (!primaryPressRef.current) return;
      event.preventDefault();
      // Defer past pending effects so edits typed just before the shortcut
      // have reached the dock's latest primary action.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => primaryPressRef.current?.())
      );
    };
    // Capture phase: react-native-web text inputs stop keydown propagation.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const width = useSharedValue(targetWidth);
  const shift = useSharedValue(targetShift);
  const height = useSharedValue(onlyPrimary ? 40 : 52);
  const backgroundOpacity = useSharedValue(onlyPrimary ? 0 : 1);

  useEffect(() => {
    if (!actions.length) return;
    width.value = withTiming(targetWidth, motion);
    shift.value = withTiming(targetShift, motion);
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
    targetShift,
    onlyPrimary,
    width,
    shift,
    height,
    backgroundOpacity,
  ]);

  const backgroundStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: height.value,
    opacity: backgroundOpacity.value,
    transform: [{ translateX: shift.value }],
  }));
  const containerStyle = useAnimatedStyle(() => ({
    width: Math.max(width.value, 52),
  }));
  const positioned = actions.map((action, index) => ({
    action,
    offset: offsets[index],
  }));
  const primary = positioned.find(({ action }) => action.primary);
  const secondary = positioned.filter(({ action }) => !action.primary);
  // Slots keep their identity (and animations) across screens, but render in
  // left-to-right order so keyboard focus follows what is on screen.
  const slots = [
    { key: 'secondary-0', slot: secondary[0] },
    { key: 'primary', slot: primary },
    { key: 'secondary-1', slot: secondary[1] },
    { key: 'secondary-2', slot: secondary[2] },
  ].sort((a, b) => (a.slot?.offset ?? Infinity) - (b.slot?.offset ?? Infinity));

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
        {slots.map(({ key, slot }) => (
          <ActionSlot
            key={key}
            action={slot?.action}
            offset={slot?.offset ?? 0}
            enabled={enabled}
          />
        ))}
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
  // A secondary menu toggle turns its + into an x while its menu is open
  // (the primary PlusCircleButton animates itself).
  const toggleOpen = Boolean(
    displayedAction && !displayedAction.primary && displayedAction.expanded
  );
  const toggleIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toggleOpen ? '45deg' : '0deg', motion) }],
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
          <Animated.View
            testID={action?.testID ? `${action.testID}-icon` : undefined}
            style={toggleIconStyle}
          >
            {content}
          </Animated.View>
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
