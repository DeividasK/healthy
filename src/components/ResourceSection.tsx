import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { CountBadge } from './CountBadge';
import { SelectedRowMarker } from './SelectedRowMarker';
import { COLORS } from '@/src/theme/colors';

interface ResourceSectionProps {
  icon: LucideIcon;
  title: string;
  /** Total rows, including any collapsed rows. Omit for non-list sections. */
  count?: number;
  testID?: string;
  /** Makes the heading a button with a chevron, e.g. opening the whole section. */
  onPress?: () => void;
  /** Accessible name of the heading button, e.g. "Open journal". */
  pressLabel?: string;
  pressTestID?: string;
  /** Control at the end of a plain heading, e.g. a filter button. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}

/** Heading plus full-width rows linking to resources related to a view; renders nothing without rows. */
export function ResourceSection({
  icon: Icon,
  title,
  count,
  testID,
  onPress,
  pressLabel,
  pressTestID,
  action,
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
      {count !== undefined && (
        <CountBadge
          count={count}
          accessibilityLabel={`${title}: ${count} total`}
          testID={testID ? `${testID}-count` : undefined}
        />
      )}
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
        <View style={styles.heading}>
          {heading}
          {action && <View style={styles.headingAction}>{action}</View>}
        </View>
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
  /** Draws attention, e.g. a journal answer that no longer matches. */
  tone?: 'warning';
}

/** How a row stands out within its list, e.g. a timeline node and status. */
export interface ResourceRowAppearance {
  /**
   * Column before the title, e.g. a timeline node. The divider then starts
   * after it, and the column spans the row's full height.
   */
  leading?: React.ReactNode;
  /** Fills the whole row, e.g. a timeline status wash. */
  backgroundColor?: string;
  /** Fades the title, meta and note, e.g. for a cancelled step. */
  dimmed?: boolean;
  /**
   * The row whose details show beside its list (desktop): marked by a bar
   * on its left edge and `aria-current`.
   */
  selected?: boolean;
}

interface ResourceRowProps extends ResourceRowAppearance {
  title: string;
  meta?: ResourceMeta[];
  /** Plain line under the title, e.g. what a starter row adds. */
  description?: string;
  /** Quoted text below the row, e.g. consultation notes. */
  note?: string | null;
  /** Opens the resource; without it the row shows no chevron. */
  onPress?: () => void;
  /**
   * Controls at the end of the row, e.g. log buttons, shown instead of the
   * chevron. With `onPress`, only the title and meta open the resource.
   */
  accessory?: React.ReactNode;
  /** Test ID of the pressable row (or of the plain row when it cannot be opened). */
  testID?: string;
  /** The row's kind, drawn before the title, e.g. a bundle in the journal. */
  typeIcon?: LucideIcon;
  /** Names `typeIcon` for screen readers, e.g. "Bundle". */
  typeLabel?: string;
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
        ({ icon: MetaIcon, text, accessibilityLabel, testID, tone }, index) => (
          <View
            key={index}
            style={styles.inlineMeta}
            testID={testID}
            accessible={Boolean(accessibilityLabel)}
            accessibilityLabel={accessibilityLabel}
          >
            <MetaIcon
              color={tone ? COLORS.light.warning : COLORS.light.muted}
              size={14}
            />
            <Text style={[styles.metaText, tone && styles.metaWarning]}>
              {text}
            </Text>
          </View>
        )
      )}
    </View>
  );
}

/**
 * One related resource: title, meta line and a chevron. The whole row opens
 * the resource; without `onPress` it is plain text with no chevron. The open
 * button takes its name from the text it shows, so voice control users can
 * say what they see (WCAG 2.5.3, label in name).
 */
export function ResourceRow({
  title,
  meta = [],
  description,
  note,
  onPress,
  accessory,
  testID,
  leading,
  backgroundColor,
  dimmed = false,
  selected = false,
  typeIcon: TypeIcon,
  typeLabel,
}: ResourceRowProps) {
  if (onPress && accessory) {
    const titleText = <Text style={styles.rowTitle}>{title}</Text>;
    // On the web the kind is an image inside the button, so the button keeps
    // its visible text as its name. Native screen readers would focus that
    // image on its own, so there the kind leads the button's label instead.
    const webTypeLabel = Platform.OS === 'web' ? typeLabel : undefined;
    return (
      <View style={styles.row} testID={testID}>
        <TouchableOpacity
          testID={`${testID}-open`}
          accessibilityRole="button"
          accessibilityLabel={
            typeLabel && !webTypeLabel ? `${typeLabel}: ${title}` : undefined
          }
          style={[styles.main, styles.mainPressable]}
          activeOpacity={0.6}
          onPress={onPress}
        >
          {TypeIcon ? (
            <View style={styles.titleLine}>
              <View
                accessible={Boolean(webTypeLabel)}
                accessibilityRole={webTypeLabel ? 'image' : undefined}
                accessibilityLabel={webTypeLabel}
              >
                <TypeIcon size={16} color={COLORS.light.primary} />
              </View>
              {titleText}
            </View>
          ) : (
            titleText
          )}
          <ResourceMetaLine meta={meta} />
        </TouchableOpacity>
        {accessory}
      </View>
    );
  }
  const body = (
    <>
      <View
        style={[
          styles.row,
          leading ? styles.rowAfterLeading : { backgroundColor },
        ]}
        testID={onPress ? `${testID}-row` : testID}
      >
        {selected && <SelectedRowMarker />}
        <View style={[styles.main, dimmed && styles.dimmed]}>
          <Text style={styles.rowTitle}>{title}</Text>
          {description && <Text style={styles.description}>{description}</Text>}
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
      {note && (
        <Text
          style={[
            styles.note,
            leading ? styles.noteAfterLeading : undefined,
            dimmed && styles.dimmed,
          ]}
        >
          &quot;{note}&quot;
        </Text>
      )}
    </>
  );
  const content = leading ? (
    <View style={[styles.leadingRow, { backgroundColor }]}>
      {leading}
      <View style={styles.leadingBody}>{body}</View>
    </View>
  ) : (
    body
  );
  const style = note && !leading ? styles.itemWithNote : undefined;
  return onPress ? (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      aria-current={selected || undefined}
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
  headingAction: {
    marginLeft: 'auto',
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
  // Spans the screen width like a row; the divider moves to the body.
  leadingRow: {
    marginHorizontal: -20,
    paddingLeft: 20,
    flexDirection: 'row',
  },
  leadingBody: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  rowAfterLeading: {
    marginHorizontal: 0,
    paddingLeft: 0,
    borderTopWidth: 0,
  },
  noteAfterLeading: {
    paddingRight: 20,
    paddingBottom: 16,
  },
  dimmed: {
    opacity: 0.6,
  },
  main: {
    flex: 1,
    gap: 5,
  },
  // Fills the row's height, so the whole area beside the controls opens it.
  mainPressable: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
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
  metaWarning: {
    color: COLORS.light.warning,
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
