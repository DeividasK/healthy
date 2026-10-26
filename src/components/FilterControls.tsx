import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ListFilter, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

/** Adds `value` to a multi-select filter, or removes it when present. */
export const toggleFilter = <T,>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

/**
 * A section heading's round filter button; filled while filters are on.
 * `label` names what it filters, e.g. "Filter timeline".
 */
export function FilterButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={active ? `${label}, filters on` : label}
      style={[styles.filterButton, active && styles.filterButtonActive]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <ListFilter
        size={18}
        color={
          active ? COLORS.light.primaryForeground : COLORS.light.textSecondary
        }
      />
    </TouchableOpacity>
  );
}

/** The stack of filter groups in a filter modal. */
export function FilterGroups({ children }: { children: React.ReactNode }) {
  return <View style={styles.groups}>{children}</View>;
}

/** A labelled group of filter controls in a filter modal. */
export function FilterGroup({
  icon: Icon,
  label,
  chips = false,
  children,
}: {
  icon: LucideIcon;
  label: string;
  /** Lays the children out as wrapping chips. */
  chips?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupLabel}>
        <Icon size={14} color={COLORS.light.muted} />
        <Text style={styles.groupLabelText}>{label}</Text>
      </View>
      {chips ? <View style={styles.chips}>{children}</View> : children}
    </View>
  );
}

/** A multi-select filter option, e.g. one status. */
export function FilterChip({
  label,
  selected,
  onPress,
  testID,
  children,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipSelected]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      {children}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Shown in a filtered list instead of rows when none match. */
export function FilterNoMatches({
  testID,
  children,
}: {
  testID: string;
  children: React.ReactNode;
}) {
  return (
    <Text style={styles.noMatches} testID={testID}>
      {children}
    </Text>
  );
}

/** A chip's status colour dot, e.g. a timeline tone. */
export function FilterDot({
  color,
  borderColor,
}: {
  color: string;
  borderColor: string;
}) {
  return <View style={[styles.dot, { backgroundColor: color, borderColor }]} />;
}

const styles = StyleSheet.create({
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: COLORS.light.primary,
    backgroundColor: COLORS.light.primary,
  },
  groups: {
    gap: 16,
    marginTop: 6,
    marginBottom: 22,
  },
  group: {
    gap: 8,
  },
  groupLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.card,
  },
  chipSelected: {
    borderColor: COLORS.light.primary,
    backgroundColor: COLORS.light.statusActiveWash,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  chipTextSelected: {
    color: COLORS.light.primary,
  },
  noMatches: {
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
});
