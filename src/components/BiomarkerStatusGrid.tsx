import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';
import {
  orderByRangeStatus,
  RANGE_STATUS_LABELS,
  RANGE_STATUSES,
  type RangeStatus,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { CountBadge } from './CountBadge';

export type BiomarkerGridItem = {
  id: string;
  name: string;
  status?: RangeStatus;
};

const SQUARE_COLORS: Record<RangeStatus, string> = {
  outOfRange: COLORS.light.outOfRange,
  inRange: COLORS.light.primary,
};
const KEY_ENTRIES = [
  ...RANGE_STATUSES.map((status) => ({
    key: status as string,
    status: status as RangeStatus | undefined,
    label: RANGE_STATUS_LABELS[status],
    color: SQUARE_COLORS[status],
  })),
  {
    key: 'noRange',
    status: undefined,
    label: 'No range',
    color: COLORS.light.noRange,
  },
];

/**
 * One square per biomarker, out of range first and those without a range
 * (light grey) last, then a key counting each status that has biomarkers.
 */
export function BiomarkerStatusGrid({
  items,
  testID,
}: {
  items: BiomarkerGridItem[];
  testID: string;
}) {
  return (
    <View testID={testID}>
      <View style={styles.grid} testID={`${testID}-squares`}>
        {orderByRangeStatus(items).map(({ id, name, status }) => (
          <View
            key={id}
            testID={`${testID}-cell-${id}`}
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${name}: ${status ? RANGE_STATUS_LABELS[status] : 'No range'}`}
            style={[
              styles.square,
              {
                backgroundColor: status
                  ? SQUARE_COLORS[status]
                  : COLORS.light.noRange,
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.key} testID={`${testID}-status-counts`}>
        {KEY_ENTRIES.map(({ key, status, label, color }) => {
          const count = items.filter((item) => item.status === status).length;
          // Only statuses some biomarker has are listed.
          if (!count) return null;
          return (
            <View
              key={key}
              style={styles.keyItem}
              testID={`${testID}-count-${key}`}
            >
              <View style={[styles.swatch, { backgroundColor: color }]} />
              <Text style={styles.keyLabel}>{label}</Text>
              <CountBadge
                count={count}
                accessibilityLabel={`${label}: ${count} biomarkers`}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  square: { width: 16, height: 16, borderRadius: 3 },
  key: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 14,
    rowGap: 6,
    marginTop: 10,
  },
  keyItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  keyLabel: { fontSize: 12, color: COLORS.light.textSecondary },
});
