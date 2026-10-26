import { StyleSheet, View } from 'react-native';
import { COLORS } from '@/src/theme/colors';

/**
 * The bar along the left edge of the row whose details show beside its list
 * (desktop). A shape, not a fill, so the row keeps its own background, e.g.
 * a status wash. Place it first inside the full-width row.
 */
export function SelectedRowMarker() {
  return <View style={styles.marker} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.light.primary,
  },
});
