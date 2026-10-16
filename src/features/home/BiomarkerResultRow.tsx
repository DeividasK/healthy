import { useRouter } from 'expo-router';
import type { Observation } from 'fhir/r5';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';
import {
  getObservationReferenceRange,
  getObservationStatus,
  type MeasurementStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';

/** Renders a consistent interpreted or reference-range status for a result. */
export function BiomarkerStatusBadge({
  observation,
  status: suppliedStatus,
  label,
  compact = false,
}: {
  observation?: Observation;
  status?: MeasurementStatus;
  label?: string;
  compact?: boolean;
}) {
  const status =
    suppliedStatus ||
    (observation ? getObservationStatus(observation) : undefined);

  if (!status) return null;

  const badgeStyle = {
    Normal: styles.badgeNormal,
    Low: styles.badgeLow,
    High: styles.badgeHigh,
  }[status];
  const textStyle = {
    Normal: styles.badgeTextNormal,
    Low: styles.badgeTextLow,
    High: styles.badgeTextHigh,
  }[status];

  return (
    <View style={[styles.badge, badgeStyle, compact && styles.compactBadge]}>
      <Text
        style={[
          styles.badgeText,
          textStyle,
          compact && styles.compactBadgeText,
        ]}
      >
        {label || status}
      </Text>
    </View>
  );
}

export function BiomarkerResultRow({
  observation: obs,
  date,
  testID,
}: {
  observation: Observation;
  date?: string;
  testID?: string;
}) {
  const router = useRouter();
  const name =
    obs.code?.coding?.[0]?.display || obs.code?.text || 'Observation';
  const value = obs.valueQuantity?.value ?? '-';
  const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
  return (
    <TouchableOpacity
      style={styles.obsItem}
      testID={
        testID || `biomarker-row-${obs.code?.coding?.[0]?.code || obs.id}`
      }
      accessibilityRole="button"
      accessibilityLabel={`View biomarker: ${name}`}
      onPress={() =>
        router.push({
          pathname: '/biomarker/[id]',
          params: {
            id:
              obs.code?.coding?.[0]?.code === 'custom'
                ? name
                : obs.code?.coding?.[0]?.code || name,
          },
        })
      }
      activeOpacity={0.75}
    >
      <View style={styles.obsLeft}>
        <Text style={styles.obsName}>{name}</Text>
        {date && (
          <Text
            style={styles.obsDate}
            testID={testID ? testID.replace('-result-', '-date-') : undefined}
          >
            {formatDisplayDate(date)}
          </Text>
        )}
        {obs.code?.coding?.[0]?.code &&
          obs.code?.coding?.[0]?.code !== 'custom' && (
            <Text style={styles.obsLoinc}>
              LOINC: {obs.code.coding[0].code}
            </Text>
          )}
      </View>

      <View style={styles.obsRight}>
        <View style={styles.valueGroup}>
          <Text style={styles.obsValue}>{value}</Text>
          <Text style={styles.obsUnit}>{unit}</Text>
        </View>
        <View style={styles.obsStatusRangeRow}>
          <BiomarkerStatusBadge observation={obs} />
          {typeof obs.valueQuantity?.value === 'number' && (
            <BiomarkerRangeLine
              value={obs.valueQuantity.value}
              {...getObservationReferenceRange(obs)}
              testID={
                testID
                  ? testID.replace('-result-', '-range-')
                  : `biomarker-range-line-${obs.code?.coding?.[0]?.code || obs.id || 'unknown'}`
              }
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  obsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  obsLeft: {
    flex: 1,
    marginRight: 12,
  },
  obsName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
    marginBottom: 2,
  },
  obsDate: { fontSize: 12, color: COLORS.light.muted },
  obsLoinc: {
    fontSize: 11,
    color: COLORS.light.muted,
  },
  obsRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  obsStatusRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  obsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  obsUnit: {
    fontSize: 13,
    color: COLORS.light.muted,
  },
  compactBadge: { paddingHorizontal: 4, paddingVertical: 0 },
  compactBadgeText: { lineHeight: 14 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNormal: {
    backgroundColor: COLORS.light.badgeNormalBg,
  },
  badgeLow: {
    backgroundColor: COLORS.light.badgeLowBg,
  },
  badgeHigh: {
    backgroundColor: COLORS.light.badgeHighBg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextNormal: {
    color: COLORS.light.badgeNormalText,
  },
  badgeTextLow: {
    color: COLORS.light.badgeLowText,
  },
  badgeTextHigh: {
    color: COLORS.light.badgeHighText,
  },
});
