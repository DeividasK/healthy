import { useRouter } from 'expo-router';
import type { Observation } from 'fhir/r5';
import { ChevronRight } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getBiomarkerKey } from '@/src/data/biomarkers';
import { COLORS } from '@/src/theme/colors';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';
import {
  getObservationMarker,
  getObservationReferenceRange,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { useRangeDemographics } from '@/src/features/lab-results/useRangeDemographics';

/**
 * Route id of an observation's biomarker page: its catalog test's key, else
 * its own code, or its name for custom tests.
 */
export function getBiomarkerRouteId(observation: Observation) {
  const marker = getObservationMarker(observation);
  if (marker) return getBiomarkerKey(marker);
  const code = observation.code?.coding?.[0]?.code;
  return code && code !== 'custom' ? code : getBiomarkerName(observation);
}

/** Display name of an observation's biomarker. */
export function getBiomarkerName(observation: Observation) {
  return (
    observation.code?.coding?.[0]?.display ||
    observation.code?.text ||
    'Observation'
  );
}

/**
 * A full-width row: title, value and unit, then the range bar and a chevron.
 * The status is left to the grid and group headings around it.
 */
export function BiomarkerValueRow({
  title,
  value,
  unit,
  low,
  high,
  onPress,
  accessibilityLabel,
  testID,
  rangeTestID,
}: {
  title: string;
  value?: number;
  unit: string;
  low?: number;
  high?: number;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
  rangeTestID?: string;
}) {
  return (
    <TouchableOpacity
      style={styles.row}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <View style={styles.main}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.valueGroup}>
          <Text style={styles.value}>{value ?? '-'}</Text>
          <Text style={styles.unit}>{unit}</Text>
        </View>
      </View>
      {typeof value === 'number' && (
        <BiomarkerRangeLine
          value={value}
          low={low}
          high={high}
          testID={rangeTestID}
        />
      )}
      <View style={styles.chevron}>
        <ChevronRight color={COLORS.light.muted} size={18} />
      </View>
    </TouchableOpacity>
  );
}

/** A biomarker's latest or reported result, opening its history. */
export function BiomarkerResultRow({
  observation,
  testID,
}: {
  observation: Observation;
  testID?: string;
}) {
  const router = useRouter();
  const demographics = useRangeDemographics();
  const name = getBiomarkerName(observation);
  const code = observation.code?.coding?.[0]?.code;
  return (
    <BiomarkerValueRow
      title={name}
      value={observation.valueQuantity?.value}
      unit={
        observation.valueQuantity?.unit || observation.valueQuantity?.code || ''
      }
      {...getObservationReferenceRange(observation, undefined, demographics)}
      testID={testID || `biomarker-row-${code || observation.id}`}
      rangeTestID={
        testID
          ? testID.replace('-result-', '-range-')
          : `biomarker-range-line-${code || observation.id || 'unknown'}`
      }
      accessibilityLabel={`View biomarker: ${name}`}
      onPress={() =>
        router.push({
          pathname: '/biomarker/[id]',
          params: { id: getBiomarkerRouteId(observation) },
        })
      }
    />
  );
}

const styles = StyleSheet.create({
  // Spans the screen width like resource rows, divided by the same hairline.
  row: {
    minHeight: 72,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  main: { flex: 1, gap: 4 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  valueGroup: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  value: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  unit: { fontSize: 13, color: COLORS.light.muted },
  // Lines up with the chevrons of resource rows.
  chevron: {
    width: 48,
    height: 48,
    marginLeft: -12,
    marginRight: -15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
