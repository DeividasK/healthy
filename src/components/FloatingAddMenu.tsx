import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  ReduceMotion,
} from 'react-native-reanimated';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppOverlay, useDockMenuAnchor } from './AppChrome';
import { getActionDockMenuOffset } from './ResourceActionDock';
import type { AddOptionItem } from './AddOptionsModal';
import { COLORS } from '@/src/theme/colors';
import { isKeyboardInput } from '@/src/utils/inputModality';
import { focusWhenReady } from '@/src/utils/focus';
import { useEscapeKey } from '@/src/utils/escapeKey';

const backdropEntry = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const menuEntry = FadeInDown.duration(200)
  .withInitialValues({ translateY: 12 })
  .reduceMotion(ReduceMotion.System);
const backdropExit = FadeOut.duration(180).reduceMotion(ReduceMotion.System);
const menuExit = FadeOutDown.duration(200)
  .withTargetValues({ translateY: 12 })
  .reduceMotion(ReduceMotion.System);

interface FloatingAddMenuProps {
  visible: boolean;
  onClose: () => void;
  options: AddOptionItem[];
  bottomOffset?: number;
  testID?: string;
}

/** The floating menu used by Home and resource action docks. */
export function FloatingAddMenu({
  visible,
  onClose,
  options,
  bottomOffset,
  testID = 'floating-add-menu',
}: FloatingAddMenuProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const itemRefs = useRef<(View | null)[]>([]);
  // Center the menu on the + that opened it, keeping a 16px screen gutter.
  const anchor = useDockMenuAnchor();
  const [menuWidth, setMenuWidth] = useState(0);
  const maxShift = Math.max(0, (screenWidth - menuWidth) / 2 - 16);
  const shift = Math.max(-maxShift, Math.min(maxShift, anchor));
  // The options mount later through AppOverlay, so focus waits for them.
  const focusFirstPending = useRef(false);
  const focusFirst = () => {
    const first = itemRefs.current[0] as unknown as HTMLElement | null;
    if (!focusFirstPending.current || !first) return;
    focusFirstPending.current = false;
    focusWhenReady(first);
  };
  const isOpen = visible && options.length > 0;

  // Web keyboard support: opening from the keyboard focuses the first option;
  // arrows and Tab/Shift+Tab cycle through the options.
  useEffect(() => {
    if (!isOpen || Platform.OS !== 'web' || typeof document === 'undefined')
      return;
    const items = () =>
      itemRefs.current.filter(Boolean) as unknown as HTMLElement[];
    focusFirstPending.current = isKeyboardInput();
    focusFirst();
    const onKeyDown = (event: KeyboardEvent) => {
      const step =
        event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)
          ? 1
          : event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)
            ? -1
            : 0;
      const list = items();
      if (!step || !list.length) return;
      event.preventDefault();
      const current = list.indexOf(document.activeElement as HTMLElement);
      const next =
        current < 0
          ? step > 0
            ? 0
            : list.length - 1
          : (current + step + list.length) % list.length;
      list[next].focus();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      focusFirstPending.current = false;
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [isOpen]);

  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  return (
    <AppOverlay>
      <Animated.View
        entering={backdropEntry}
        exiting={backdropExit}
        style={styles.backdrop}
      >
        <Pressable
          testID={`${testID}-backdrop`}
          accessibilityRole="button"
          accessibilityLabel="Close add menu"
          style={styles.backdropPressable}
          onPress={onClose}
        />
      </Animated.View>
      <Animated.View
        entering={menuEntry}
        exiting={menuExit}
        style={[
          styles.menu,
          {
            bottom: bottomOffset ?? getActionDockMenuOffset(insets.bottom),
            // Grow with the longest label, but keep a gutter to the screen edges.
            maxWidth: screenWidth - 32,
            // Margins rather than a transform: the entering and exiting
            // animations own the transform.
            marginLeft: Math.max(0, shift) * 2,
            marginRight: Math.max(0, -shift) * 2,
          },
        ]}
        onLayout={(event) => setMenuWidth(event.nativeEvent.layout.width)}
        testID={testID}
      >
        {options.map((option, index) => (
          <React.Fragment key={option.id}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              ref={(node) => {
                itemRefs.current[index] = node;
                if (index === 0) focusFirst();
              }}
              testID={option.testID}
              accessibilityRole="button"
              style={styles.item}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              activeOpacity={0.7}
            >
              {option.icon}
              <Text style={styles.itemText}>{option.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </Animated.View>
    </AppOverlay>
  );
}

const styles = StyleSheet.create({
  backdropPressable: { flex: 1 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.light.modalBackdrop,
    zIndex: 90,
  },
  menu: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 200,
    zIndex: 95,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    ...Platform.select({
      web: { boxShadow: COLORS.light.shadowWebModalCard },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light.border,
  },
});
