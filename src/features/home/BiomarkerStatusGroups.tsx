import type { Observation } from 'fhir/r5';
import { StyleSheet, Text, View } from 'react-native';
import { CountBadge } from '@/src/components/CountBadge';
import { COLORS } from '@/src/theme/colors';
import {
  RANGE_STATUS_LABELS,
  RANGE_STATUSES,
  type RangeStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { BiomarkerResultRow } from './BiomarkerResultRow';

export type GroupedBiomarker = {
  id: string;
  observation: Observation;
  status?: RangeStatus;
};

/**
 * Biomarker rows under Out of range, In range and No range headings, each
 * with its count; empty groups are left out. Rows keep the given order.
 */
export function BiomarkerStatusGroups({
  biomarkers,
  testID,
  rowTestID,
}: {
  biomarkers: GroupedBiomarker[];
  testID: string;
  rowTestID?: (biomarker: GroupedBiomarker) => string;
}) {
  const groups = [...RANGE_STATUSES, undefined]
    .map((status) => ({
      key: status ?? 'noRange',
      label: status ? RANGE_STATUS_LABELS[status] : 'No range',
      items: biomarkers.filter((biomarker) => biomarker.status === status),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <View testID={testID}>
      {groups.map(({ key, label, items }) => (
        <View key={key} style={styles.group} testID={`${testID}-${key}`}>
          <View style={styles.heading}>
            <Text style={styles.title} accessibilityRole="header">
              {label}
            </Text>
            <CountBadge
              count={items.length}
              accessibilityLabel={`${label}: ${items.length} biomarkers`}
              testID={`${testID}-${key}-count`}
            />
          </View>
          {items.map((biomarker) => (
            <BiomarkerResultRow
              key={biomarker.id}
              observation={biomarker.observation}
              testID={rowTestID?.(biomarker)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Closes the last row with the same full-width hairline.
  group: {
    marginTop: 24,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
});
