import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Calendar } from 'lucide-react-native';
import { AppLogo } from './AppLogo';
import { ProfileHeaderButton } from '@/src/features/profile/ProfileHeaderButton';
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
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      testID={testID}
      edges={['top', 'left', 'right']}
      style={styles.safeArea}
    >
      <View style={styles.page}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.headerButton}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            activeOpacity={0.7}
          >
            <ChevronLeft color={COLORS.light.primary} size={24} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Home"
            style={styles.headerButton}
            onPress={() => router.dismissTo('/')}
            activeOpacity={0.8}
          >
            <AppLogo size={28} color={COLORS.light.primary} />
          </TouchableOpacity>
          <View style={styles.headerButton}>
            <ProfileHeaderButton style={styles.profileButton} />
          </View>
        </View>

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
    maxWidth: 448,
    alignSelf: 'center',
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.card,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    marginRight: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.light.emptyIconContainer,
    borderColor: COLORS.light.card,
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
