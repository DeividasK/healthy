import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

interface ResourceSectionProps {
  icon: LucideIcon;
  title: string;
  testID?: string;
  /** Makes the heading a button with a chevron, e.g. opening the whole section. */
  onPress?: () => void;
  /** Accessible name of the heading button, e.g. "Open journal". */
  pressLabel?: string;
  pressTestID?: string;
  children?: React.ReactNode;
}

/** Heading plus full-width rows linking to resources related to a view; renders nothing without rows. */
export function ResourceSection({
  icon: Icon,
  title,
  testID,
  onPress,
  pressLabel,
  pressTestID,
  children,
}: ResourceSectionProps) {
  // Sections with no related resources are left out entirely.
  if (React.Children.toArray(children).length === 0) return null;
  const heading = (
    <>
      <Icon size={18} color={COLORS.light.primary} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
    </>
  );
  return (
    <View style={[styles.section, styles.list]} testID={testID}>
      {onPress ? (
        <TouchableOpacity
          testID={pressTestID}
          accessibilityRole="button"
          accessibilityLabel={pressLabel ?? title}
          style={[styles.heading, styles.pressableHeading]}
          activeOpacity={0.6}
          onPress={onPress}
        >
          {heading}
          <View style={styles.headingChevron}>
            <ChevronRight color={COLORS.light.muted} size={18} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.heading}>{heading}</View>
      )}
      {children}
    </View>
  );
}

export interface ResourceMeta {
  icon: LucideIcon;
  text: string;
  /** Accessible description read instead of the bare text, e.g. "2 treatments". */
  accessibilityLabel?: string;
  testID?: string;
}

interface ResourceRowProps {
  title: string;
  meta?: ResourceMeta[];
  /** Quoted text below the row, e.g. consultation notes. */
  note?: string | null;
  /** Opens the resource; without it the row shows no chevron. */
  onPress?: () => void;
  /** Controls shown at the end of a row that does not open, e.g. log buttons. */
  accessory?: React.ReactNode;
  /** Accessible name of the open button, e.g. "View condition: Migraine". */
  accessibilityLabel?: string;
  /** Test ID of the pressable row (or of the plain row when it cannot be opened). */
  testID?: string;
}

/**
 * A resource's meta line: date, status, specialist, then type-specific
 * fields and association counts, each with its concept icon. Shared by
 * resource rows and view-page headings so both read the same way.
 */
export function ResourceMetaLine({ meta }: { meta: ResourceMeta[] }) {
  if (!meta.length) return null;
  return (
    <View style={styles.meta}>
      {meta.map(
        ({ icon: MetaIcon, text, accessibilityLabel, testID }, index) => (
          <View
            key={index}
            style={styles.inlineMeta}
            testID={testID}
            accessible={Boolean(accessibilityLabel)}
            accessibilityLabel={accessibilityLabel}
          >
            <MetaIcon color={COLORS.light.muted} size={14} />
            <Text style={styles.metaText}>{text}</Text>
          </View>
        )
      )}
    </View>
  );
}

/**
 * One related resource: title, meta line and a chevron. The whole row opens
 * the resource; without `onPress` it is plain text with no chevron.
 */
export function ResourceRow({
  title,
  meta = [],
  note,
  onPress,
  accessory,
  accessibilityLabel,
  testID,
}: ResourceRowProps) {
  const content = (
    <>
      <View style={styles.row} testID={onPress ? `${testID}-row` : testID}>
        <View style={styles.main}>
          <Text style={styles.rowTitle}>{title}</Text>
          <ResourceMetaLine meta={meta} />
        </View>
        {onPress ? (
          <View style={styles.chevron}>
            <ChevronRight color={COLORS.light.muted} size={18} />
          </View>
        ) : (
          accessory
        )}
      </View>
      {note && <Text style={styles.note}>&quot;{note}&quot;</Text>}
    </>
  );
  const style = note ? styles.itemWithNote : undefined;
  return onPress ? (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
      activeOpacity={0.6}
      onPress={onPress}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={style}>{content}</View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 2,
    marginBottom: 24,
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  list: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  // Spans the section, so tapping anywhere on the heading line opens it.
  pressableHeading: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  // Lines up with the chevrons of resource rows.
  headingChevron: {
    marginLeft: 'auto',
    marginRight: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  row: {
    minHeight: 60,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    gap: 10,
  },
  // The negative margin keeps the chevron at the edge.
  chevron: {
    width: 48,
    height: 48,
    marginRight: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemWithNote: {
    marginBottom: 16,
  },
  main: {
    flex: 1,
    gap: 5,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    // Wrapped meta lines keep the same spacing as the title and first line.
    rowGap: 5,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
  },
  note: {
    paddingTop: 8,
    paddingHorizontal: 1,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    color: COLORS.light.textSecondary,
  },
});
