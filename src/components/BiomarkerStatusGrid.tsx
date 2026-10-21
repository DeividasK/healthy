import { Pressable, StyleSheet, Text, View } from 'react-native';
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

/**
 * One square per biomarker, out of range first, then a key counting each
 * status. Biomarkers without a reference range are light grey and uncounted.
 */
export function BiomarkerStatusGrid({
  items,
  onPressItem,
  testID,
}: {
  items: BiomarkerGridItem[];
  onPressItem: (id: string) => void;
  testID: string;
}) {
  return (
    <View testID={testID}>
      <View style={styles.grid} testID={`${testID}-squares`}>
        {orderByRangeStatus(items).map(({ id, name, status }) => (
          <Pressable
            key={id}
            testID={`${testID}-cell-${id}`}
            accessibilityRole="button"
            accessibilityLabel={`${name}: ${status ? RANGE_STATUS_LABELS[status] : 'No range'}`}
            hitSlop={2}
            onPress={() => onPressItem(id)}
            style={({ pressed }) => [
              styles.square,
              {
                backgroundColor: status
                  ? SQUARE_COLORS[status]
                  : COLORS.light.noRange,
              },
              pressed && styles.pressed,
            ]}
          />
        ))}
      </View>
      <View style={styles.key} testID={`${testID}-status-counts`}>
        {RANGE_STATUSES.map((status) => {
          const count = items.filter((item) => item.status === status).length;
          const label = RANGE_STATUS_LABELS[status];
          return (
            <View
              key={status}
              style={styles.keyItem}
              testID={`${testID}-count-${status}`}
            >
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: SQUARE_COLORS[status] },
                ]}
              />
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
  pressed: { opacity: 0.6 },
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
