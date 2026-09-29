import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  useColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import {
  Plus,
  Calendar,
  Building2,
  ChevronRight,
  ShieldCheck,
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Cloud,
  User,
} from 'lucide-react-native';
import { useLabReports } from '../../src/context/LabReportsContext';
import { useUserProfile } from '../../src/context/UserProfileContext';
import { useLanguage } from '../../src/i18n';
import { useResponsive } from '../../src/hooks/useResponsive';

export default function HomeScreen() {
  const {
    reports,
    isLoading,
    refreshReports,
    totalReports,
    totalMarkersCount,
    latestReport,
    syncStatus,
  } = useLabReports();
  const { profile } = useUserProfile();
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isLargeScreen, contentMaxWidth, containerPadding } = useResponsive();

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
      contentContainerStyle={[
        styles.contentContainer,
        {
          maxWidth: contentMaxWidth,
          width: '100%',
          alignSelf: 'center',
          paddingHorizontal: containerPadding,
        },
      ]}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refreshReports} />
      }
    >
      {/* Brand & Privacy Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <Heart size={22} color="#EF4444" fill="#EF4444" />
            <Text
              style={[
                styles.brandTitle,
                { color: isDark ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              Healthy
            </Text>
          </View>
          <Text
            style={[
              styles.subtitle,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('home.subtitle')}
          </Text>
        </View>

        <View style={styles.headerRightBadges}>
          <TouchableOpacity
            style={[
              styles.profileBadge,
              { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
            ]}
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.7}
          >
            <User size={13} color="#2563EB" />
            <Text style={styles.profileBadgeText}>
              {profile.name ? profile.name.split(' ')[0] : t('tabs.profile')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.syncBadge,
              { backgroundColor: isDark ? '#1E293B' : '#EFF6FF' },
            ]}
            onPress={() => router.push('/(tabs)/sync' as any)}
            activeOpacity={0.7}
          >
            <Cloud size={13} color="#2563EB" />
            <Text style={styles.syncBadgeText}>
              {syncStatus.state === 'syncing' ? t('home.syncing') : t('home.driveSync')}
            </Text>
          </TouchableOpacity>

          <View
            style={[
              styles.privacyBadge,
              { backgroundColor: isDark ? '#1E293B' : '#ECFDF5' },
            ]}
          >
            <ShieldCheck size={14} color="#10B981" />
            <Text style={styles.privacyText}>{t('home.onDeviceBadge')}</Text>
          </View>
        </View>
      </View>

      {/* Hero Primary Action Button */}
      <TouchableOpacity
        style={styles.heroButton}
        onPress={() => router.push('/add-report')}
        activeOpacity={0.85}
      >
        <View style={styles.heroBtnContent}>
          <View style={styles.heroIconWrapper}>
            <Plus size={24} color="#FFFFFF" strokeWidth={2.5} />
          </View>
          <View style={styles.heroTextWrapper}>
            <Text style={styles.heroBtnTitle}>{t('home.addReportBtn')}</Text>
            <Text style={styles.heroBtnSubtitle}>
              {t('home.addReportBtnSubtitle')}
            </Text>
          </View>
        </View>
        <ChevronRight size={22} color="#FFFFFF" opacity={0.8} />
      </TouchableOpacity>

      {/* Stats Summary Cards */}
      <View style={styles.statsContainer}>
        <View
          style={[
            styles.statCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('home.totalReports')}
          </Text>
          <Text
            style={[
              styles.statValue,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {totalReports}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('home.markersTracked')}
          </Text>
          <Text style={[styles.statValue, { color: '#2563EB' }]}>
            {totalMarkersCount}
          </Text>
        </View>

        <View
          style={[
            styles.statCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text
            style={[
              styles.statLabel,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            {t('home.latestDate')}
          </Text>
          <Text
            style={[
              styles.statValueDate,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
            numberOfLines={1}
          >
            {latestReport ? latestReport.testDate : '—'}
          </Text>
        </View>
      </View>

      {/* Lab Reports History List */}
      <View style={styles.historySection}>
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? '#F8FAFC' : '#0F172A' },
          ]}
        >
          {t('home.recordedReports')}
        </Text>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563EB" />
          </View>
        ) : reports.length === 0 ? (
          <View
            style={[
              styles.emptyStateCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.emptyIconCircle}>
              <FileSpreadsheet size={32} color="#2563EB" />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: isDark ? '#F8FAFC' : '#0F172A' },
              ]}
            >
              {t('home.emptyTitle')}
            </Text>
            <Text
              style={[
                styles.emptyDescription,
                { color: isDark ? '#94A3B8' : '#64748B' },
              ]}
            >
              {t('home.emptySubtitle')}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/add-report')}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>{t('home.addFirstReportBtn')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={
              isLargeScreen && reports.length > 1
                ? styles.reportsGrid
                : undefined
            }
          >
            {reports.map((report) => {
              const normalCount = report.markers.filter(
                (m) => m.status === 'normal'
              ).length;
              const abnormalCount = report.markers.filter(
                (m) =>
                  m.status === 'low' ||
                  m.status === 'high' ||
                  m.status === 'critical'
              ).length;

              return (
                <TouchableOpacity
                  key={report.id}
                  style={[
                    styles.reportCard,
                    isLargeScreen && reports.length > 1 && styles.reportCardGrid,
                    {
                      backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                  onPress={() => router.push(`/report/${report.id}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportMain}>
                    <View style={styles.reportHeaderRow}>
                      <View style={styles.dateBadge}>
                        <Calendar size={14} color="#2563EB" />
                        <Text style={styles.dateBadgeText}>
                          {report.testDate}
                        </Text>
                      </View>

                      {report.labName && (
                        <View style={styles.labBadge}>
                          <Building2
                            size={12}
                            color={isDark ? '#94A3B8' : '#64748B'}
                          />
                          <Text
                            style={[
                              styles.labBadgeText,
                              { color: isDark ? '#94A3B8' : '#64748B' },
                            ]}
                            numberOfLines={1}
                          >
                            {report.labName}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.reportTagsRow}>
                      <View
                        style={[
                          styles.markerCountBadge,
                          { backgroundColor: isDark ? '#334155' : '#F1F5F9' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.markerCountText,
                            { color: isDark ? '#CBD5E1' : '#475569' },
                          ]}
                        >
                          {report.markers.length} {t('home.biomarkersCount')}
                        </Text>
                      </View>

                      <View style={styles.statusPillsRow}>
                        <View style={styles.normalPill}>
                          <CheckCircle2 size={11} color="#10B981" />
                          <Text style={styles.normalPillText}>
                            {normalCount} {t('home.normalCount')}
                          </Text>
                        </View>

                        {abnormalCount > 0 && (
                          <View style={styles.abnormalPill}>
                            <AlertTriangle size={11} color="#EF4444" />
                            <Text style={styles.abnormalPillText}>
                              {abnormalCount} {t('home.abnormalCount')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>

                  <ChevronRight
                    size={18}
                    color={isDark ? '#64748B' : '#94A3B8'}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  headerRightBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  profileBadgeFlag: {
    fontSize: 13,
  },
  profileBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  syncBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  heroButton: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  heroBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  heroIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrapper: {
    flex: 1,
  },
  heroBtnTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  heroBtnSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '400',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statValueDate: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  historySection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  loadingContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyStateCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  reportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  reportCardGrid: {
    flex: 1,
    minWidth: 320,
    maxWidth: '49.5%',
  },
  reportCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  reportMain: {
    flex: 1,
    marginRight: 10,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2563EB',
  },
  labBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  labBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reportTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  markerCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  markerCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  normalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  normalPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  abnormalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  abnormalPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
});
