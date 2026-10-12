import React from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppOverlay } from './AppChrome';
import { getActionDockMenuOffset } from './ResourceActionDock';
import type { AddOptionItem } from './AddOptionsModal';
import { COLORS } from '@/src/theme/colors';

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
  if (!visible || options.length === 0) return null;

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
          { bottom: bottomOffset ?? getActionDockMenuOffset(insets.bottom) },
        ]}
        testID={testID}
      >
        {options.map((option, index) => (
          <React.Fragment key={option.id}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity
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
    width: 200,
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
