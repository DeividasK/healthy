import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { X, AlertCircle, CheckCircle2, TrendingUp, Info } from 'lucide-react-native';
import { BiomarkerResult, LabReport } from '../types/health';
import { BIOMARKER_CATALOG } from '../data/biomarker-catalog';
import { formatValue } from '../utils/units';
import { useTranslation } from 'react-i18next';
import { getBiomarkerDisplayName, getBiomarkerDescription } from '../i18n/biomarkers';
import { WhoopBiomarkerGauge } from './WhoopBiomarkerGauge';

export interface WhoopBiomarkerModalProps {
  visible: boolean;
  marker: BiomarkerResult | null;
  allReports?: LabReport[];
  onClose: () => void;
}

export const WhoopBiomarkerModal: React.FC<WhoopBiomarkerModalProps> = ({
  visible,
  marker,
  allReports = [],
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  if (!marker) return null;

  const displayName = getBiomarkerDisplayName(marker, language);

  // Look up catalog definition for clinical context
  const catalogEntry = useMemo(() => {
    return BIOMARKER_CATALOG.find(
      (b) =>
        b.canonicalKey === marker.canonicalKey ||
        b.loinc === marker.loinc ||
        b.name.toLowerCase() === marker.name.toLowerCase()
    );
  }, [marker]);

  // Gather past history for this marker
  const markerHistory = useMemo(() => {
    const history: { date: string; value: number; unit: string; status: string }[] = [];
    for (const report of allReports) {
      const match = report.markers.find(
        (m) =>
          (m.canonicalKey && m.canonicalKey === marker.canonicalKey) ||
          m.name.toLowerCase() === marker.name.toLowerCase()
      );
      if (match && match.value !== undefined) {
        history.push({
          date: report.testDate,
          value: match.value,
          unit: match.unit,
          status: match.status,
        });
      }
    }
    return history.sort((a, b) => b.date.localeCompare(a.date));
  }, [allReports, marker]);

  const isOutOfRange =
    marker.status === 'low' ||
    marker.status === 'high' ||
    marker.status === 'critical';

  const refMin = marker.referenceMin ?? catalogEntry?.referenceIntervals.conventional.min;
  const refMax = marker.referenceMax ?? catalogEntry?.referenceIntervals.conventional.max;

  const rawCategory = marker.category || catalogEntry?.category;
  const localizedCategory = rawCategory
    ? t(`biomarkers.categories.${rawCategory}`) || rawCategory
    : t('biomarkers.catalog');

  const getStatusText = (status: string) => {
    switch (status) {
      case 'normal':
        return t('status.normal');
      case 'low':
        return t('status.low');
      case 'high':
        return t('status.high');
      case 'critical':
        return t('status.critical');
      default:
        return t('status.recorded');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header Bar */}
          <View style={styles.sheetHeader}>
            <View style={styles.dragIndicator} />
            <View style={styles.headerTitleRow}>
              <View style={styles.titleWrapper}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.sheetCategory}>
                  {localizedCategory}
                  {language === 'lt' && displayName !== marker.name ? ` • ${marker.name}` : ''}
                  {marker.loinc ? ` • LOINC ${marker.loinc}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color="#CBD5E1" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={styles.sheetContent}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
          >
            {/* Primary Result Box */}
            <View style={styles.resultBox}>
              <View style={styles.resultValueRow}>
                <Text style={styles.resultValueText}>
                  {marker.value !== undefined ? formatValue(marker.value) : '—'}
                </Text>
                <Text style={styles.resultUnitText}>{marker.unit}</Text>
              </View>

              <View
                style={[
                  styles.statusBadgeLarge,
                  isOutOfRange
                    ? styles.statusBadgeWarning
                    : styles.statusBadgeSufficient,
                ]}
              >
                {isOutOfRange ? (
                  <AlertCircle size={14} color="#F59E0B" />
                ) : (
                  <CheckCircle2 size={14} color="#2DD4BF" />
                )}
                <Text
                  style={[
                    styles.statusBadgeLargeText,
                    isOutOfRange
                      ? styles.statusTextWarning
                      : styles.statusTextSufficient,
                  ]}
                >
                  {isOutOfRange ? t('common.outOfRange') : t('common.sufficient')}
                </Text>
              </View>

              {/* Large Gauge Display */}
              <View style={styles.largeGaugeContainer}>
                <WhoopBiomarkerGauge
                  value={marker.value}
                  min={refMin}
                  max={refMax}
                  status={marker.status}
                  width={280}
                />
                <View style={styles.gaugeLabelsRow}>
                  <Text style={styles.gaugeLabelText}>
                    {refMin !== undefined
                      ? `${t('biomarkers.minLabel', { val: String(refMin) })} ${marker.unit}`
                      : t('biomarkers.lowerLabel')}
                  </Text>
                  <Text style={styles.gaugeLabelText}>
                    {refMax !== undefined
                      ? `${t('biomarkers.maxLabel', { val: String(refMax) })} ${marker.unit}`
                      : t('biomarkers.upperLabel')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Reference Interval Details */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{t('biomarkers.referenceStandards')}</Text>
              <View style={styles.refGrid}>
                <View style={styles.refItem}>
                  <Text style={styles.refLabel}>{t('biomarkers.standardInterval')}</Text>
                  <Text style={styles.refVal}>
                    {refMin !== undefined && refMax !== undefined
                      ? `${refMin} – ${refMax} ${marker.unit}`
                      : refMax !== undefined
                      ? `< ${refMax} ${marker.unit}`
                      : refMin !== undefined
                      ? `> ${refMin} ${marker.unit}`
                      : t('biomarkers.noFixedInterval')}
                  </Text>
                </View>

                {catalogEntry?.referenceIntervals.si && (
                  <View style={styles.refItem}>
                    <Text style={styles.refLabel}>{t('biomarkers.siUnitInterval')}</Text>
                    <Text style={styles.refVal}>
                      {catalogEntry.referenceIntervals.si.text ||
                        `${catalogEntry.referenceIntervals.si.min} - ${catalogEntry.referenceIntervals.si.max} ${catalogEntry.siUnit}`}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Clinical Description / About */}
            {(marker.notes || catalogEntry?.description) && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Info size={16} color="#00C48C" />
                  <Text style={styles.sectionTitle}>{t('biomarkers.clinicalOverview')}</Text>
                </View>
                <Text style={styles.descriptionText}>
                  {getBiomarkerDescription(
                    {
                      canonicalKey: marker.canonicalKey,
                      name: marker.name,
                      description: marker.notes || catalogEntry?.description,
                    },
                    language
                  )}
                </Text>
              </View>
            )}

            {/* Historical Tracking */}
            {markerHistory.length > 1 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <TrendingUp size={16} color="#38BDF8" />
                  <Text style={styles.sectionTitle}>
                    {t('biomarkers.historyTitle', { count: markerHistory.length })}
                  </Text>
                </View>
                {markerHistory.map((item, idx) => (
                  <View key={`${item.date}-${idx}`} style={styles.historyRow}>
                    <Text style={styles.historyDate}>{item.date}</Text>
                    <Text style={styles.historyValue}>
                      {formatValue(item.value)} {item.unit}
                    </Text>
                    <View
                      style={[
                        styles.historyStatusPill,
                        item.status === 'normal'
                          ? styles.historyPillNormal
                          : styles.historyPillAbnormal,
                      ]}
                    >
                      <Text
                        style={[
                          styles.historyStatusText,
                          {
                            color:
                              item.status === 'normal' ? '#2DD4BF' : '#F59E0B',
                          },
                        ]}
                      >
                        {getStatusText(item.status)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#121820',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: '#24303E',
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#1F2A38',
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#37475A',
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrapper: {
    flex: 1,
    marginRight: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sheetCategory: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9CAE',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1F2A38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetContent: {
    paddingHorizontal: 20,
  },
  scrollInner: {
    paddingVertical: 18,
    gap: 14,
  },
  resultBox: {
    backgroundColor: '#161E28',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#243142',
    padding: 18,
    alignItems: 'center',
  },
  resultValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  resultValueText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  resultUnitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E9CAE',
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 18,
  },
  statusBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  statusBadgeSufficient: {
    backgroundColor: 'rgba(20, 184, 166, 0.16)',
  },
  statusBadgeLargeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextWarning: {
    color: '#F59E0B',
  },
  statusTextSufficient: {
    color: '#2DD4BF',
  },
  largeGaugeContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  gaugeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: 8,
  },
  gaugeLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7A8D',
  },
  sectionCard: {
    backgroundColor: '#161E28',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#243142',
    padding: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  refGrid: {
    gap: 10,
  },
  refItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  refLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9CAE',
  },
  refVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  descriptionText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#CBD5E1',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#1F2A38',
  },
  historyDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  historyValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  historyStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  historyPillNormal: {
    backgroundColor: 'rgba(20, 184, 166, 0.14)',
  },
  historyPillAbnormal: {
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
