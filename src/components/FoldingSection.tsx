import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * A section that folds under its heading: the title, anything beside it
 * (`badge`, e.g. a count) and a chevron. Pressing anywhere on the heading
 * line opens or closes it; a full-width hairline closes the section. While
 * `disabled` it stays open and the chevron is hidden.
 */
export function FoldingSection({
  title,
  isOpen,
  onToggle,
  accessibilityLabel = title,
  disabled = false,
  badge,
  testID,
  children,
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  badge?: React.ReactNode;
  /** The section's id; its heading is `<testID>-toggle`. */
  testID: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <TouchableOpacity
        style={styles.heading}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        aria-expanded={isOpen}
        disabled={disabled}
        activeOpacity={0.6}
        onPress={onToggle}
        testID={`${testID}-toggle`}
      >
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {badge}
        {!disabled && (
          <View style={[styles.chevron, isOpen && styles.chevronExpanded]}>
            <ChevronDown color={COLORS.light.muted} size={18} />
          </View>
        )}
      </TouchableOpacity>
      {isOpen && children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 24,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  // Spans the section, so pressing anywhere on the heading line toggles it.
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    marginBottom: 4,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  // Lines up with the chevrons of rows.
  chevron: { marginLeft: 'auto' },
  chevronExpanded: { transform: [{ rotate: '180deg' }] },
});
