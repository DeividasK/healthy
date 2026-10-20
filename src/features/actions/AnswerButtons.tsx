import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ArrowDown,
  ArrowUp,
  Check,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { TreatmentLogAnswer } from './actionDays';

/**
 * "Not taken" (×) and "taken" (✓) buttons for a journal row. Pressing the
 * selected button again clears the answer.
 */
export function AnswerButtons({
  answer,
  name,
  testIDPrefix,
  disabled = false,
  onAnswer,
}: {
  answer: TreatmentLogAnswer | null;
  /** What is answered, read in the buttons' labels. */
  name: string;
  /** e.g. `treatment-log` gives `treatment-log-taken-<rowId>`; omitted while leaving. */
  testIDPrefix?: { prefix: string; rowId: string };
  disabled?: boolean;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
}) {
  const button = (
    value: TreatmentLogAnswer,
    Icon: LucideIcon,
    label: string,
    selectedStyle: object
  ) => {
    const selected = answer === value;
    return (
      <TouchableOpacity
        testID={
          testIDPrefix &&
          `${testIDPrefix.prefix}-${value}-${testIDPrefix.rowId}`
        }
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${name} ${label}`}
        aria-checked={selected}
        accessibilityState={{ checked: selected, disabled }}
        disabled={disabled}
        style={[styles.button, selected && selectedStyle]}
        activeOpacity={0.6}
        onPress={() => onAnswer(selected ? null : value)}
      >
        <Icon
          color={
            selected ? COLORS.light.primaryForeground : COLORS.light.iconMuted
          }
          size={18}
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.buttons}>
      {button('not-taken', X, 'not taken', styles.notTaken)}
      {button('taken', Check, 'taken', styles.taken)}
    </View>
  );
}

/**
 * "Move up" and "move down" buttons, shown instead of a journal row's answer
 * buttons while the journal is reordered. A missing handler disables its
 * button.
 */
export function ReorderButtons({
  name,
  testIDSuffix,
  onMoveUp,
  onMoveDown,
}: {
  /** What is moved, read in the buttons' labels. */
  name: string;
  /** e.g. the row id gives `journal-move-up-<rowId>`; omitted while leaving. */
  testIDSuffix?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const button = (
    direction: 'up' | 'down',
    Icon: LucideIcon,
    onPress?: () => void
  ) => (
    <TouchableOpacity
      testID={testIDSuffix && `journal-move-${direction}-${testIDSuffix}`}
      accessibilityRole="button"
      accessibilityLabel={`Move ${name} ${direction}`}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      style={[styles.button, !onPress && styles.disabled]}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <Icon color={COLORS.light.iconMuted} size={18} strokeWidth={2.5} />
    </TouchableOpacity>
  );
  return (
    <View style={styles.buttons}>
      {button('up', ArrowUp, onMoveUp)}
      {button('down', ArrowDown, onMoveDown)}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.pillBackground,
  },
  taken: {
    backgroundColor: COLORS.light.primary,
  },
  notTaken: {
    backgroundColor: COLORS.light.textSecondary,
  },
  disabled: {
    opacity: 0.4,
  },
});
