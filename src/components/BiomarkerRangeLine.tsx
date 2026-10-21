import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { getRangeZones } from './biomarkerRangeZones';

const ZONE_COLORS = {
  outOfRange: {
    line: COLORS.light.outOfRange,
    fill: COLORS.light.outOfRangeTint,
  },
  inRange: { line: COLORS.light.primary, fill: COLORS.light.inRangeTint },
};

/**
 * Places a result on a bar of out-of-range and in-range zones sized to the
 * reference range, marked by a triangle. The large bar also labels the limits.
 */
export function BiomarkerRangeLine({
  value,
  low,
  high,
  width = 120,
  large = false,
  testID,
}: {
  value: number;
  low?: number;
  high?: number;
  width?: number | '100%';
  large?: boolean;
  testID?: string;
}) {
  const layout = getRangeZones(value, low, high);
  if (!layout) return null;

  return (
    <View
      style={[styles.container, { width }]}
      testID={testID}
      accessibilityLabel="Value compared with the reference range"
    >
      <View style={[styles.bar, large && styles.largeBar]}>
        {layout.zones.map(({ status, width: zoneWidth }, index) => (
          <View
            key={index}
            style={[
              styles.zone,
              large && styles.largeZone,
              {
                flexGrow: zoneWidth,
                borderTopColor: ZONE_COLORS[status].line,
                backgroundColor: ZONE_COLORS[status].fill,
              },
            ]}
          />
        ))}
      </View>
      <View
        style={[
          styles.marker,
          large && styles.largeMarker,
          { left: `${layout.marker}%` },
        ]}
      />
      {large && (
        <View style={styles.limits}>
          {layout.limits.map(({ value: limit, position }) => (
            <Text
              key={limit}
              style={[styles.limit, { left: `${position}%` }]}
              testID={testID ? `${testID}-limit` : undefined}
            >
              {limit}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Leaves room above the bar for the triangle marker.
  container: { position: 'relative', paddingTop: 10 },
  bar: {
    flexDirection: 'row',
    gap: 1,
    height: 12,
    borderRadius: 2,
    overflow: 'hidden',
  },
  largeBar: { height: 16, borderRadius: 3 },
  zone: { flexBasis: 0, height: 12, borderTopWidth: 3 },
  largeZone: { height: 16, borderTopWidth: 4 },
  marker: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    marginLeft: -7,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: COLORS.light.foreground,
  },
  largeMarker: {
    marginLeft: -8,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 11,
    top: -1,
  },
  limits: { position: 'relative', height: 16, marginTop: 4 },
  // Centered on its boundary.
  limit: {
    position: 'absolute',
    width: 48,
    marginLeft: -24,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.light.textSecondary,
  },
});
