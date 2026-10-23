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
}: ResourceViewLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      testID={testID}
      edges={['left', 'right']}
      style={styles.safeArea}
    >
      <View style={styles.page}>
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
              // Lets keyboard users focus and scroll the page on web even
              // when it has no focusable content of its own.
              tabIndex={0}
              style={styles.scroll}
              contentContainerStyle={[
                styles.content,
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
