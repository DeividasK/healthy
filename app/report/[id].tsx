import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  Calendar,
  Building2,
  FileText,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react-native';
import { useLabReports } from '../../src/context/LabReportsContext';
import { formatValue } from '../../src/utils/units';
import { useResponsive } from '../../src/hooks/useResponsive';
import { BiomarkerResult } from '../../src/types/health';
import { WhoopAmbientHeader } from '../../src/components/WhoopAmbientHeader';
import { WhoopBiomarkerCard } from '../../src/components/WhoopBiomarkerCard';
import { WhoopBiomarkerModal } from '../../src/components/WhoopBiomarkerModal';
import { SAMPLE_WHOOP_LAB_REPORT } from '../../src/data/sampleWhoopLabs';
import { useLanguage } from '../../src/i18n';
import { getBiomarkerDisplayName } from '../../src/i18n/biomarkers';

export default function ReportDetailScreen() {
  const { language, t } = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reports, getReportById, deleteReport } = useLabReports();
  const { isLargeScreen, contentMaxWidth, containerPadding } = useResponsive();
  const [selectedMarker, setSelectedMarker] = useState<BiomarkerResult | null>(null);

  // If ID matches sample or if not found in db, check if it's sample report
  const report = useMemo(() => {
    if (!id) return undefined;
    const found = getReportById(id);
    if (found) return found;
    if (id === SAMPLE_WHOOP_LAB_REPORT.id) {
      return SAMPLE_WHOOP_LAB_REPORT;
    }
    return undefined;
  }, [id, getReportById]);

  if (!report) {
    return (
      <View style={styles.centerContainer}>
        <WhoopAmbientHeader
          title={t('reportDetail.screenTitle')}
          onBack={() => router.back()}
        />
        <View style={styles.notFoundBody}>
          <Text style={styles.notFoundText}>
            {t('reportDetail.notFound')}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.backBtnText}>{t('reportDetail.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Split markers into Out of Range and Sufficient
  const outOfRangeMarkers = useMemo(() => {
    return report.markers.filter(
      (m) =>
        m.status === 'low' ||
        m.status === 'high' ||
        m.status === 'critical'
    );
  }, [report.markers]);

  const sufficientMarkers = useMemo(() => {
    return report.markers.filter((m) => m.status === 'normal');
  }, [report.markers]);

  const otherMarkers = useMemo(() => {
    return report.markers.filter(
      (m) =>
        m.status !== 'normal' &&
        m.status !== 'low' &&
        m.status !== 'high' &&
        m.status !== 'critical'
    );
  }, [report.markers]);

  const handleDelete = () => {
    const confirmDelete = async () => {
      await deleteReport(report.id);
      router.back();
    };

    if (Platform.OS === 'web') {
      if (window.confirm(t('reportDetail.deleteConfirm'))) {
        confirmDelete();
      }
    } else {
      Alert.alert(
        t('reportDetail.deleteTitle'),
        t('reportDetail.deleteConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: confirmDelete },
        ]
      );
    }
  };

  const handleEdit = () => {
    router.push({
      pathname: '/add-report',
      params: { id: report.id },
    });
  };

  const handleShare = async () => {
    const summaryLines = [
      t('reportDetail.shareSummaryTitle'),
      `${t('addReport.testDate')}: ${report.testDate}`,
      report.labName ? `${t('addReport.labLabel')}: ${report.labName}` : '',
      `${t('reportDetail.totalTests')}: ${report.markers.length}`,
      `• ${t('reportDetail.outOfRange')}: ${outOfRangeMarkers.length}`,
      `• ${t('reportDetail.inRange')}: ${sufficientMarkers.length}`,
      '',
      `--- ${t('reportDetail.outOfRange').toUpperCase()} ---`,
      ...outOfRangeMarkers.map(
        (m) =>
          `• ${getBiomarkerDisplayName(m, language)}: ${m.value !== undefined ? formatValue(m.value) : '—'} ${m.unit} [${m.status.toUpperCase()}]`
      ),
      '',
      `--- ${t('reportDetail.inRange').toUpperCase()} ---`,
      ...sufficientMarkers.map(
        (m) =>
          `• ${getBiomarkerDisplayName(m, language)}: ${m.value !== undefined ? formatValue(m.value) : '—'} ${m.unit}`
      ),
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({
        message: summaryLines,
        title: `${t('reportDetail.shareSummaryTitle')} - ${report.testDate}`,
      });
    } catch (e) {
      // Ignored
    }
  };

  return (
    <View style={styles.container}>
      {/* WHOOP Ambient Gradient Header */}
      <WhoopAmbientHeader
        title={t('reportDetail.screenTitle')}
        onBack={() => router.back()}
        onAction={handleShare}
        actionIcon="download"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.contentContainer,
          {
            maxWidth: contentMaxWidth,
            width: '100%',
            alignSelf: 'center',
            paddingHorizontal: containerPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Report Meta Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaTop}>
            <View style={styles.dateRow}>
              <Calendar size={16} color="#00C48C" />
              <Text style={styles.reportDate}>{report.testDate}</Text>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Edit3 size={15} color="#94A3B8" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={15} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>

          {report.labName && (
            <View style={styles.metaRow}>
              <Building2 size={14} color="#8E9CAE" />
              <Text style={styles.metaText}>{report.labName}</Text>
            </View>
          )}

          {report.notes && (
            <View style={styles.metaRow}>
              <FileText size={14} color="#8E9CAE" />
              <Text style={styles.metaNotesText}>{report.notes}</Text>
            </View>
          )}

          {/* Quick Metrics Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statCount}>{report.markers.length}</Text>
              <Text style={styles.statLabel}>{t('reportDetail.totalTests')}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <View style={styles.statBadgeRow}>
                <AlertTriangle size={13} color="#F59E0B" />
                <Text style={[styles.statCount, { color: '#F59E0B' }]}>
                  {outOfRangeMarkers.length}
                </Text>
              </View>
              <Text style={styles.statLabel}>{t('reportDetail.outOfRange')}</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statBox}>
              <View style={styles.statBadgeRow}>
                <CheckCircle2 size={13} color="#00C48C" />
                <Text style={[styles.statCount, { color: '#00C48C' }]}>
                  {sufficientMarkers.length}
                </Text>
              </View>
              <Text style={styles.statLabel}>{t('reportDetail.inRange')}</Text>
            </View>
          </View>
        </View>

        {/* --- SECTION 1: OUT OF RANGE (Needs Attention) --- */}
        {outOfRangeMarkers.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('biomarkers.needsAttention')}</Text>
              <Text style={styles.sectionSubtitle}>
                {outOfRangeMarkers.length === 1
                  ? t('biomarkers.biomarkerSingle', { count: 1 })
                  : t('biomarkers.biomarkersCount', { count: outOfRangeMarkers.length })}
              </Text>
            </View>

            <View
              style={
                isLargeScreen && outOfRangeMarkers.length > 1
                  ? styles.gridContainer
                  : undefined
              }
            >
              {outOfRangeMarkers.map((marker) => (
                <View
                  key={marker.id}
                  style={
                    isLargeScreen && outOfRangeMarkers.length > 1
                      ? styles.gridItem
                      : undefined
                  }
                >
                  <WhoopBiomarkerCard
                    marker={marker}
                    onPress={() => setSelectedMarker(marker)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- SECTION 2: SUFFICIENT (In Range) --- */}
        {sufficientMarkers.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('biomarkers.sufficient')}</Text>
              <Text style={styles.sectionSubtitle}>
                {t('biomarkers.biomarkersCount', { count: sufficientMarkers.length })}
              </Text>
            </View>

            <View
              style={
                isLargeScreen && sufficientMarkers.length > 1
                  ? styles.gridContainer
                  : undefined
              }
            >
              {sufficientMarkers.map((marker) => (
                <View
                  key={marker.id}
                  style={
                    isLargeScreen && sufficientMarkers.length > 1
                      ? styles.gridItem
                      : undefined
                  }
                >
                  <WhoopBiomarkerCard
                    marker={marker}
                    onPress={() => setSelectedMarker(marker)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* --- SECTION 3: OTHER / UNCLASSIFIED --- */}
        {otherMarkers.length > 0 && (
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t('biomarkers.otherResults')}</Text>
              <Text style={styles.sectionSubtitle}>
                {t('biomarkers.biomarkersCount', { count: otherMarkers.length })}
              </Text>
            </View>

            {otherMarkers.map((marker) => (
              <WhoopBiomarkerCard
                key={marker.id}
                marker={marker}
                onPress={() => setSelectedMarker(marker)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Biomarker Detail Sheet */}
      <WhoopBiomarkerModal
        visible={!!selectedMarker}
        marker={selectedMarker}
        allReports={reports}
        onClose={() => setSelectedMarker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1217',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 48,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0D1217',
  },
  notFoundBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundText: {
    fontSize: 16,
    color: '#8E9CAE',
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: '#00C48C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0D1217',
    fontWeight: '700',
  },
  metaCard: {
    backgroundColor: '#161C24',
    borderColor: '#232D3B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  metaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportDate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E2734',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#8E9CAE',
    flex: 1,
  },
  metaNotesText: {
    fontSize: 13,
    color: '#CBD5E1',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#232D3B',
    marginTop: 14,
    paddingTop: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#232D3B',
  },
  statBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statCount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E9CAE',
    marginTop: 2,
  },
  sectionWrap: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9CAE',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    flex: 1,
    minWidth: 320,
    maxWidth: '49.5%',
  },
});
