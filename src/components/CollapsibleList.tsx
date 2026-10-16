import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { COLORS } from '@/src/theme/colors';

const DEFAULT_VISIBLE_COUNT = 3;
const motion = {
  duration: 240,
  easing: Easing.inOut(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

/**
 * Shows the first few items of a section with a toggle that slides the rest
 * open or closed.
 */
export function CollapsibleList<T>({
  items,
  renderItem,
  testID,
  visibleCount = DEFAULT_VISIBLE_COUNT,
}: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  testID: string;
  visibleCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  // Hidden items stay mounted while they slide closed.
  const [renderHidden, setRenderHidden] = useState(false);
  const contentHeight = useSharedValue(0);
  const progress = useSharedValue(0);
  const canToggle = items.length > visibleCount;
  const label = expanded ? 'Show less' : 'Show all';

  const toggle = () => {
    if (expanded) {
      setExpanded(false);
      progress.value = withTiming(0, motion, (finished) => {
        if (finished) scheduleOnRN(setRenderHidden, false);
      });
    } else {
      setExpanded(true);
      setRenderHidden(true);
      progress.value = withTiming(1, motion);
    }
  };

  const hiddenStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
  }));
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <View testID={testID}>
      {items.slice(0, visibleCount).map(renderItem)}
      {canToggle && renderHidden && (
        <Animated.View style={[styles.hidden, hiddenStyle]}>
          <View
            style={styles.hiddenContent}
            onLayout={(event) => {
              contentHeight.value = event.nativeEvent.layout.height;
            }}
          >
            {items.slice(visibleCount).map(renderItem)}
          </View>
        </Animated.View>
      )}
      {canToggle && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-expanded={expanded}
          onPress={toggle}
          style={styles.toggle}
          testID={`${testID}-toggle`}
        >
          <Text style={styles.toggleText}>{label}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color={COLORS.light.foreground} />
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Clips at the section edges so the rows' full-bleed borders stay visible.
  hidden: { overflow: 'hidden', marginHorizontal: -20 },
  // Laid out at its natural height so the wrapper can slide to it.
  hiddenContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  // Bleeds to the section edges like the rows, so the last row has a border.
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    marginHorizontal: -20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
