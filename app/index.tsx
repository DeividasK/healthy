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
  Activity,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react-native';
import { useLabReports } from '../src/context/LabReportsContext';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../src/hooks/useResponsive';

export default function HomeScreen() {
  const {
    reports,
    isLoading,
    refreshReports,
  } = useLabReports();
  const { t } = useTranslation();
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
      {/* Lab Reports History List */}
      <View style={styles.historySection}>
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('home.recordedReports')}
          </Text>
          {reports.length > 0 && (
            <TouchableOpacity
              style={[
                styles.addSmallBtn,
                {
                  backgroundColor: isDark ? '#1E293B' : '#EFF6FF',
                  borderColor: isDark ? '#334155' : '#DBEAFE',
                },
              ]}
              onPress={() => router.push('/add-report')}
              activeOpacity={0.7}
            >
              <Plus size={14} color="#2563EB" />
              <Text style={styles.addSmallBtnText}>
                {t('common.add', 'Add')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

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
  historySection: {
    marginBottom: 20,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  addSmallBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
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
