import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

interface RelatedResourceSectionProps {
  icon: LucideIcon;
  title: string;
  testID?: string;
  /** Shown instead of rows when there are none; omit to show only rows. */
  emptyText?: string;
  emptyTestID?: string;
  children?: React.ReactNode;
}

/** Heading plus full-width rows linking to resources related to a view. */
export function RelatedResourceSection({
  icon: Icon,
  title,
  testID,
  emptyText,
  emptyTestID,
  children,
}: RelatedResourceSectionProps) {
  const hasRows = React.Children.toArray(children).length > 0;
  return (
    <View style={[styles.section, hasRows && styles.list]} testID={testID}>
      <View style={styles.heading}>
        <Icon size={18} color={COLORS.light.primary} />
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {hasRows ? (
        children
      ) : emptyText ? (
        <Text style={styles.emptyText} testID={emptyTestID}>
          {emptyText}
        </Text>
      ) : null}
    </View>
  );
}

export interface RelatedResourceMeta {
  icon?: LucideIcon;
  text: string;
}

interface RelatedResourceRowProps {
  title: string;
  meta?: RelatedResourceMeta[];
  /** Quoted text below the row, e.g. consultation notes. */
  note?: string | null;
  /** Opens the resource; without it the row shows no chevron. */
  onPress?: () => void;
  /** Accessible name of the open button, e.g. "View condition: Migraine". */
  accessibilityLabel?: string;
  /** Test ID of the open button (or of the row when it cannot be opened). */
  testID?: string;
}

/**
 * One related resource: title, meta line and a chevron. Only the 48x48
 * chevron button opens the resource, so the rest of the row is plain text.
 */
export function RelatedResourceRow({
  title,
  meta = [],
  note,
  onPress,
  accessibilityLabel,
  testID,
}: RelatedResourceRowProps) {
  return (
    <View style={note ? styles.itemWithNote : undefined}>
      <View style={styles.row} testID={onPress ? `${testID}-row` : testID}>
        <View style={styles.main}>
          <Text style={styles.rowTitle}>{title}</Text>
          {meta.length > 0 && (
            <View style={styles.meta}>
              {meta.map(({ icon: MetaIcon, text }, index) =>
                MetaIcon ? (
                  <View key={index} style={styles.inlineMeta}>
                    <MetaIcon color={COLORS.light.muted} size={14} />
                    <Text style={styles.metaText}>{text}</Text>
                  </View>
                ) : (
                  <Text key={index} style={styles.metaText}>
                    {text}
                  </Text>
                )
              )}
            </View>
          )}
        </View>
        {onPress && (
          <TouchableOpacity
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            style={styles.openButton}
            activeOpacity={0.6}
            onPress={onPress}
          >
            <ChevronRight color={COLORS.light.muted} size={18} />
          </TouchableOpacity>
        )}
      </View>
      {note && <Text style={styles.note}>&quot;{note}&quot;</Text>}
    </View>
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
  // 48x48 touch target; the negative margin keeps the chevron at the edge.
  openButton: {
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
    gap: 12,
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
  emptyText: {
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.light.mutedForeground,
  },
});
