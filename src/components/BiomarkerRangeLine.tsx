import { StyleSheet, View } from 'react-native';

/** Places a numeric result on a compact track with low, normal and high regions. */
export function BiomarkerRangeLine({
  value,
  low,
  high,
  width = 96,
  testID,
}: {
  value: number;
  low?: number;
  high?: number;
  width?: number;
  testID?: string;
}) {
  if (low === undefined || high === undefined || high <= low) return null;

  const rangeSpan = high - low;
  const min = Math.min(low, value) - rangeSpan * 0.5;
  const max = Math.max(high, value) + rangeSpan * 0.5;
  const scale = max - min;
  const lowWidth = ((low - min) / scale) * 100;
  const normalWidth = ((high - low) / scale) * 100;
  const highWidth = 100 - lowWidth - normalWidth;
  const markerPosition = ((value - min) / scale) * 100;

  return (
    <View
      style={[styles.track, { width }]}
      testID={testID}
      accessibilityLabel="Value compared with the reference range"
    >
      <View style={[styles.segment, styles.low, { width: `${lowWidth}%` }]} />
      <View
        style={[styles.segment, styles.normal, { width: `${normalWidth}%` }]}
      />
      <View style={[styles.segment, styles.high, { width: `${highWidth}%` }]} />
      <View style={[styles.divider, { left: `${lowWidth}%` }]} />
      <View style={[styles.divider, { left: `${lowWidth + normalWidth}%` }]} />
      <View style={[styles.marker, { left: `${markerPosition}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: 'relative',
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'visible',
  },
  segment: { height: 4, opacity: 0.7 },
  low: { backgroundColor: '#3B82F6' },
  normal: { backgroundColor: '#10B981' },
  high: { backgroundColor: '#EF4444' },
  divider: {
    position: 'absolute',
    top: 0,
    width: 1,
    height: 4,
    backgroundColor: '#000000',
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 8,
    height: 8,
    marginLeft: -4,
    borderRadius: 4,
    backgroundColor: '#000000',
  },
});
