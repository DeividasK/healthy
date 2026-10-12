import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Calendar } from 'lucide-react-native';
import { ResourceActionDock } from './ResourceActionDock';
import { COLORS } from '@/src/theme/colors';

interface ResourceViewLayoutProps {
  testID: string;
  title?: string;
  titleTestID?: string;
  date?: string;
  status?: { label: string; color?: string };
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
  date,
  status,
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
        {isLoading || error ? (
          <View style={styles.center}>
            {isLoading ? (
              <ActivityIndicator size="large" color={COLORS.light.primary} />
            ) : (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>
        ) : (
          <>
            <ScrollView
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
                {(date || status) && (
                  <View style={styles.metadata}>
                    {date && (
                      <View style={styles.inlineMetadata}>
                        <Calendar color={COLORS.light.muted} size={14} />
                        <Text style={styles.date}>{date}</Text>
                      </View>
                    )}
                    {status && (
                      <View style={styles.inlineMetadata}>
                        {status.color && (
                          <View
                            style={[
                              styles.statusDot,
                              { backgroundColor: status.color },
                            ]}
                          />
                        )}
                        <Text style={styles.status}>{status.label}</Text>
                      </View>
                    )}
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
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 14,
  },
  inlineMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  date: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
