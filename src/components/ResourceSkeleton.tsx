import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useDelayedVisibility } from './LoadingView';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN } from '@/src/theme/layout';

/** Row title widths, varied so the placeholder reads as a list. */
const TITLE_WIDTHS: DimensionValue[] = ['62%', '48%', '70%', '55%'];
const META_WIDTHS: DimensionValue[] = ['38%', '44%', '32%', '40%'];

export interface ResourceSkeletonProps {
  /** Adds a page title and meta line above the sections (view pages). */
  heading?: boolean;
  sections?: number;
  rowsPerSection?: number;
  testID?: string;
}

/**
 * Stands in for resources while they load: section headings and rows shaped
 * like `ResourceSection` and `ResourceRow`, so content replaces it in place.
 * Like `LoadingView`, it appears only once a load takes noticeably long.
 */
export function ResourceSkeleton({
  heading = false,
  sections = 2,
  rowsPerSection = 3,
  testID = 'resource-skeleton',
}: ResourceSkeletonProps) {
  const visible = useDelayedVisibility();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (!visible) return;
    opacity.value = withRepeat(
      withTiming(0.45, { duration: 800, reduceMotion: ReduceMotion.System }),
      -1,
      true,
      undefined,
      ReduceMotion.System
    );
  }, [visible, opacity]);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel="Loading"
      style={styles.container}
    >
      {visible && (
        <Animated.View style={pulse}>
          {heading && (
            <View style={styles.heading}>
              <View style={[styles.bar, styles.titleBar]} />
              <View style={[styles.bar, styles.headingMetaBar]} />
            </View>
          )}
          {Array.from({ length: sections }, (_, section) => (
            <View key={section} style={styles.section}>
              <View style={styles.sectionHeading}>
                <View style={[styles.bar, styles.icon]} />
                <View style={[styles.bar, styles.sectionTitle]} />
              </View>
              <View style={styles.list}>
                {Array.from({ length: rowsPerSection }, (_, row) => {
                  const index = section + row;
                  return (
                    <View key={row} testID="skeleton-row" style={styles.row}>
                      <View
                        style={[
                          styles.bar,
                          styles.rowTitle,
                          { width: TITLE_WIDTHS[index % TITLE_WIDTHS.length] },
                        ]}
                      />
                      <View
                        style={[
                          styles.bar,
                          styles.rowMeta,
                          { width: META_WIDTHS[index % META_WIDTHS.length] },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...CONTENT_COLUMN,
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    backgroundColor: COLORS.light.background,
  },
  bar: {
    borderRadius: 6,
    backgroundColor: COLORS.light.pillBackground,
  },
  heading: {
    marginBottom: 30,
    gap: 18,
  },
  titleBar: {
    width: '58%',
    height: 26,
  },
  headingMetaBar: {
    width: '46%',
    height: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    width: 20,
    height: 20,
  },
  sectionTitle: {
    width: 120,
    height: 18,
  },
  list: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  row: {
    minHeight: 60,
    paddingVertical: 12,
    justifyContent: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  rowTitle: {
    height: 14,
  },
  rowMeta: {
    height: 10,
  },
});
