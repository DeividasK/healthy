import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { BiomarkerStatus } from '../types/health';

export interface WhoopBiomarkerGaugeProps {
  value?: number;
  min?: number;
  max?: number;
  status: BiomarkerStatus;
  width?: number;
  style?: object;
  hasBorderlineZones?: boolean;
}

const COLOR_AMBER = '#D97706'; // WHOOP out-of-range / suboptimal warm amber
const COLOR_TEAL = '#00C48C';  // WHOOP signature electric emerald / in-range
const COLOR_SLATE = '#1E3636'; // WHOOP intermediate / borderline muted slate-teal

export const WhoopBiomarkerGauge: React.FC<WhoopBiomarkerGaugeProps> = ({
  value,
  min,
  max,
  status,
  width = 130,
  style,
  hasBorderlineZones = false,
}) => {
  // Calculate horizontal percentage for triangle pointer
  const pointerPercent = React.useMemo(() => {
    if (value === undefined || value === null || isNaN(value)) {
      return 50;
    }

    // Both Min and Max defined (standard 2-sided range)
    if (min !== undefined && max !== undefined && max > min) {
      const range = max - min;
      if (value < min) {
        const diff = min - value;
        const normalized = Math.min(1, diff / (range * 0.8 || 1));
        return Math.max(5, 25 - normalized * 20);
      }
      if (value > max) {
        const diff = value - max;
        const normalized = Math.min(1, diff / (range * 0.8 || 1));
        return Math.min(95, 75 + normalized * 20);
      }
      // Between min and max (25% to 75%)
      const ratio = (value - min) / range;
      return 25 + ratio * 50;
    }

    // Upper limit only (e.g. ApoB, FIB-4, Triglycerides where lower is better)
    if (max !== undefined && max > 0 && (min === undefined || min === 0)) {
      if (value <= max) {
        const ratio = Math.max(0, value / max);
        return Math.min(52, Math.max(5, ratio * 52));
      }
      const diff = value - max;
      const normalized = Math.min(1, diff / (max * 0.6));
      return Math.min(95, 75 + normalized * 20);
    }

    // Lower limit only (e.g. eGFR where higher is better)
    if (min !== undefined && min > 0 && max === undefined) {
      if (value < min) {
        const ratio = Math.max(0, value / min);
        return Math.max(5, ratio * 28);
      }
      const diff = value - min;
      const normalized = Math.min(1, diff / (min * 0.8));
      return Math.min(95, 52 + normalized * 43);
    }

    // Fallback based on status if no numerical boundaries
    if (status === 'low') return 12;
    if (status === 'high' || status === 'critical') return 88;
    return 50;
  }, [value, min, max, status]);

  // Determine segments layout
  const isUpperLimitOnly =
    max !== undefined && max > 0 && (min === undefined || min === 0);
  const isLowerLimitOnly =
    min !== undefined && min > 0 && max === undefined;

  return (
    <View style={[styles.container, { width }, style]}>
      {/* Pointer row with inverted white triangle */}
      <View style={styles.pointerTrack}>
        <View
          style={[
            styles.pointerWrapper,
            {
              left: `${pointerPercent}%`,
            },
          ]}
        >
          <Svg width={9} height={6} viewBox="0 0 9 6">
            <Polygon points="0,0 9,0 4.5,5.5" fill="#FFFFFF" />
          </Svg>
        </View>
      </View>

      {/* Horizontal segmented gauge bar */}
      <View style={styles.bar}>
        {isUpperLimitOnly ? (
          // Upper-bound only: [Teal (Optimal)] [Slate (Borderline)] [Amber (High)]
          <>
            <View style={[styles.segment, { flex: 54, backgroundColor: COLOR_TEAL }]} />
            <View style={[styles.segment, { flex: 18, backgroundColor: COLOR_SLATE }]} />
            <View style={[styles.segment, { flex: 28, backgroundColor: COLOR_AMBER }]} />
          </>
        ) : isLowerLimitOnly ? (
          // Lower-bound only: [Amber (Low)] [Slate (Borderline)] [Teal (Optimal)]
          <>
            <View style={[styles.segment, { flex: 28, backgroundColor: COLOR_AMBER }]} />
            <View style={[styles.segment, { flex: 18, backgroundColor: COLOR_SLATE }]} />
            <View style={[styles.segment, { flex: 54, backgroundColor: COLOR_TEAL }]} />
          </>
        ) : hasBorderlineZones ? (
          // 5-segment with borderline zones: [Amber] [Slate] [Teal] [Slate] [Amber]
          <>
            <View style={[styles.segment, { flex: 22, backgroundColor: COLOR_AMBER }]} />
            <View style={[styles.segment, { flex: 10, backgroundColor: COLOR_SLATE }]} />
            <View style={[styles.segment, { flex: 36, backgroundColor: COLOR_TEAL }]} />
            <View style={[styles.segment, { flex: 10, backgroundColor: COLOR_SLATE }]} />
            <View style={[styles.segment, { flex: 22, backgroundColor: COLOR_AMBER }]} />
          </>
        ) : (
          // Standard 3-segment: [Amber (Low)] [Teal (Normal)] [Amber (High)]
          <>
            <View style={[styles.segment, { flex: 26, backgroundColor: COLOR_AMBER }]} />
            <View style={[styles.segment, { flex: 48, backgroundColor: COLOR_TEAL }]} />
            <View style={[styles.segment, { flex: 26, backgroundColor: COLOR_AMBER }]} />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 18,
    justifyContent: 'flex-end',
  },
  pointerTrack: {
    height: 7,
    width: '100%',
    position: 'relative',
    marginBottom: 2,
  },
  pointerWrapper: {
    position: 'absolute',
    top: 0,
    marginLeft: -4.5,
  },
  bar: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    gap: 1.5,
  },
  segment: {
    height: '100%',
  },
});
