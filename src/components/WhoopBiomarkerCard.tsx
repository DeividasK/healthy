import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { BiomarkerResult } from '../types/health';
import { formatValue } from '../utils/units';
import { useTranslation } from 'react-i18next';
import { getBiomarkerDisplayName } from '../i18n/biomarkers';
import { WhoopBiomarkerGauge } from './WhoopBiomarkerGauge';

export interface WhoopBiomarkerCardProps {
  marker: BiomarkerResult;
  onPress?: () => void;
  style?: object;
  gaugeWidth?: number;
}

export const WhoopBiomarkerCard: React.FC<WhoopBiomarkerCardProps> = ({
  marker,
  onPress,
  style,
  gaugeWidth = 126,
}) => {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  const isOutOfRange =
    marker.status === 'low' ||
    marker.status === 'high' ||
    marker.status === 'critical';

  // Check if this marker typically has borderline zones (e.g. Albumin/Globulin ratio)
  const hasBorderlineZones =
    marker.name.toLowerCase().includes('ratio') ||
    marker.canonicalKey.includes('ratio');

  const formattedValue =
    marker.value !== undefined ? formatValue(marker.value) : '—';

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Top Row: Biomarker Name & Chevron */}
      <View style={styles.topRow}>
        <Text style={styles.markerName} numberOfLines={1}>
          {getBiomarkerDisplayName(marker, language)}
        </Text>
        <ChevronRight size={18} color="#6B7A8D" />
      </View>

      {/* Bottom Row: Large Value + Unit + Status Badge on Left, Gauge on Right */}
      <View style={styles.bottomRow}>
        <View style={styles.valueAndStatusCol}>
          <View style={styles.valueRow}>
            <Text style={styles.valueText}>{formattedValue}</Text>
            {marker.unit ? (
              <Text style={styles.unitText}>{marker.unit}</Text>
            ) : null}
          </View>

          <View
            style={[
              styles.statusBadge,
              isOutOfRange
                ? styles.statusBadgeWarning
                : styles.statusBadgeSufficient,
            ]}
          >
            {isOutOfRange && (
              <Text style={styles.warningExclamation}>! </Text>
            )}
            <Text
              style={[
                styles.statusBadgeText,
                isOutOfRange
                  ? styles.statusTextWarning
                  : styles.statusTextSufficient,
              ]}
            >
              {isOutOfRange ? t('common.outOfRange') : t('common.sufficient')}
            </Text>
          </View>
        </View>

        {/* WHOOP Horizontal Range Gauge */}
        <View style={styles.gaugeWrapper}>
          <WhoopBiomarkerGauge
            value={marker.value}
            min={marker.referenceMin}
            max={marker.referenceMax}
            status={marker.status}
            width={gaugeWidth}
            hasBorderlineZones={hasBorderlineZones}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#161C24',
    borderColor: '#232D3B',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  markerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    flex: 1,
    marginRight: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  valueAndStatusCol: {
    flex: 1,
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 6,
  },
  valueText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  unitText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E9CAE',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.16)',
  },
  statusBadgeSufficient: {
    backgroundColor: 'rgba(20, 184, 166, 0.16)',
  },
  warningExclamation: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusTextWarning: {
    color: '#F59E0B',
  },
  statusTextSufficient: {
    color: '#2DD4BF',
  },
  gaugeWrapper: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
    paddingBottom: 2,
  },
});
