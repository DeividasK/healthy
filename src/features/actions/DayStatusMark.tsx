import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, Minus, X } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { DayStatus } from './actionDays';

/**
 * A day's logging state: a check once everything is answered, a dash while
 * some answers are missing, a cross before any answer, a small dot when
 * nothing is due and an empty circle for days still to come. Today has no
 * cross before its first answer: the day is still going, not missed.
 */
export function DayStatusMark({
  status,
  highlighted = false,
  isToday = false,
  size = 28,
  testID,
}: {
  status: DayStatus;
  /** Outlines the circle in the brand colour, e.g. for today. */
  highlighted?: boolean;
  /** Leaves out the cross while nothing is logged yet. */
  isToday?: boolean;
  size?: number;
  testID?: string;
}) {
  const iconSize = Math.round(size * 0.6);
  if (status === 'none') {
    return (
      <View
        testID={testID}
        style={[styles.slot, { width: size, height: size }]}
      >
        <View style={styles.dot} />
      </View>
    );
  }
  return (
    <View
      testID={testID}
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2 },
        status === 'complete'
          ? styles.complete
          : status === 'partial'
            ? styles.partial
            : status === 'empty'
              ? styles.empty
              : styles.open,
        highlighted && status !== 'complete' && styles.highlighted,
      ]}
    >
      {status === 'complete' && (
        <Check
          color={COLORS.light.primaryForeground}
          size={iconSize}
          strokeWidth={3}
        />
      )}
      {status === 'partial' && (
        <Minus color={COLORS.light.primary} size={iconSize} strokeWidth={3} />
      )}
      {status === 'empty' && !isToday && (
        <X color={COLORS.light.primary} size={iconSize} strokeWidth={3} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  complete: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  partial: {
    backgroundColor: COLORS.light.background,
    borderColor: COLORS.light.primary,
  },
  // Something to log: outlined in the brand colour like a partly logged day.
  empty: {
    backgroundColor: COLORS.light.background,
    borderColor: COLORS.light.primary,
  },
  open: {
    backgroundColor: COLORS.light.pillBackground,
    borderColor: COLORS.light.pillBorder,
  },
  highlighted: {
    borderColor: COLORS.light.primary,
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.light.pillBorder,
  },
});
