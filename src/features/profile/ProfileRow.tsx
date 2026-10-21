import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * One full-width line on the profile page: an icon, a title with an
 * optional subtitle, and a control or action icon at the end. With
 * `onPress` the whole row is the button.
 */
export function ProfileRow({
  icon: Icon,
  title,
  subtitle,
  trailing,
  onPress,
  disabled,
  accessibilityLabel,
  testID,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const content = (
    <>
      <Icon size={20} color={COLORS.light.primary} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle !== undefined && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing && <View style={styles.trailing}>{trailing}</View>}
    </>
  );
  return onPress ? (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.row}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View testID={testID} style={styles.row}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.light.textSecondary,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
