import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { ResourceActionDock } from './ResourceActionDock';
import { ResourceSkeleton } from './ResourceSkeleton';
import { ResourceMetaLine, type ResourceMeta } from './ResourceSection';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN, WIDE_MAX_WIDTH } from '@/src/theme/layout';

interface ResourceViewLayoutProps {
  testID: string;
  title?: string;
  titleTestID?: string;
  /** Same meta line as the resource's rows: date, status, specialist, then type-specific fields. */
  meta?: ResourceMeta[];
  isLoading?: boolean;
  error?: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  modal?: React.ReactNode;
  /** Uses the wider desktop column for side-by-side layouts. */
  wide?: boolean;
  /**
   * Identifies what the page shows when one screen switches between records
   * in place: a change starts the content afresh at the top, without
   * reloading or showing the skeleton.
   */
  contentKey?: string;
  /**
   * Desktop panel beside the content, e.g. the chosen biomarker's detail.
   * The content then scrolls as a list column on the left.
   */
  aside?: React.ReactNode;
  /** Native ID of the content's scroll view, e.g. for list arrow keys. */
  scrollID?: string;
}

/** Shared navigation and compact page layout for resource detail screens. */
export function ResourceViewLayout({
  testID,
  title,
  titleTestID,
  meta = [],
  isLoading,
  error,
  children,
  actions,
  modal,
  wide = false,
  contentKey,
  aside,
  scrollID,
}: ResourceViewLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      testID={testID}
      edges={['left', 'right']}
      style={styles.safeArea}
    >
      <View style={[styles.page, aside != null && styles.split]}>
        {error && <ResourceActionDock actions={[]} />}
        {isLoading ? (
          <ResourceSkeleton heading />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            <ScrollView
              key={contentKey}
              nativeID={scrollID}
              // Lets keyboard users focus and scroll the page on web even
              // when it has no focusable content of its own.
              tabIndex={0}
              style={[styles.scroll, aside != null && styles.list]}
              contentContainerStyle={[
                styles.content,
                wide && { maxWidth: WIDE_MAX_WIDTH },
                { paddingBottom: insets.bottom + 132 },
              ]}
            >
              <View style={styles.heading}>
                <Text
                  style={styles.title}
                  testID={titleTestID}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
                {meta.length > 0 && (
                  <View style={styles.metadata}>
                    <ResourceMetaLine meta={meta} />
                  </View>
                )}
              </View>
              {children}
            </ScrollView>
            {aside != null && <View style={styles.aside}>{aside}</View>}
            {actions}
            {modal}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  page: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
  },
  split: {
    flexDirection: 'row',
    maxWidth: WIDE_MAX_WIDTH,
  },
  // Same width as the biomarker list beside its detail.
  list: {
    width: 440,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.light.cardBorder,
  },
  aside: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  content: {
    ...CONTENT_COLUMN,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  heading: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    letterSpacing: -0.4,
    color: COLORS.light.foreground,
  },
  metadata: {
    marginTop: 14,
  },
});
