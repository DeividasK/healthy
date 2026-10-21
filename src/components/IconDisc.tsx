import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A concept icon on a pale green disc, e.g. leading a starter row or a
 * Welcome trust point.
 */
export function IconDisc({
  icon: Icon,
  size = 40,
  style,
}: {
  icon: LucideIcon;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      <Icon size={size / 2} color={COLORS.light.primary} />
    </View>
  );
}

/** Leading column for `ResourceRow`: the disc, centred beside the row. */
export function RowIconDisc({ icon }: { icon: LucideIcon }) {
  return (
    <View style={styles.leading}>
      <IconDisc icon={icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: COLORS.light.emptyIconContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leading: {
    justifyContent: 'center',
    paddingVertical: 12,
    paddingRight: 14,
  },
});
