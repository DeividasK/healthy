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
 * selected button again clears the answer. `mixed` tints both while a group
 * is fully answered with both answers.
 */
export function AnswerButtons({
  answer,
  name,
  testIDPrefix,
  disabled = false,
  mixed = false,
  labels = { taken: 'taken', notTaken: 'not taken' },
  onAnswer,
}: {
  answer: TreatmentLogAnswer | null;
  /** What is answered, read in the buttons' labels. */
  name: string;
  /** e.g. `treatment-log` gives `treatment-log-taken-<rowId>`; omitted while leaving. */
  testIDPrefix?: { prefix: string; rowId: string };
  disabled?: boolean;
  /** Every item of a group is answered, some taken and some not. */
  mixed?: boolean;
  /** The answers in words, e.g. "done" and "not done" for a procedure. */
  labels?: { taken: string; notTaken: string };
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
}) {
  const button = (
    value: TreatmentLogAnswer,
    Icon: LucideIcon,
    label: string,
    selectedStyle: object,
    tintStyle: object,
    tintColor: string
  ) => {
    const selected = answer === value;
    const tinted = mixed && !answer;
    return (
      <TouchableOpacity
        testID={
          testIDPrefix &&
          `${testIDPrefix.prefix}-${value}-${testIDPrefix.rowId}`
        }
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${name} ${label}`}
        aria-checked={tinted ? 'mixed' : selected}
        accessibilityState={{ checked: tinted ? 'mixed' : selected, disabled }}
        disabled={disabled}
        style={[styles.button, selected && selectedStyle, tinted && tintStyle]}
        activeOpacity={0.6}
        onPress={() => onAnswer(selected ? null : value)}
      >
        <Icon
          color={
            selected
              ? COLORS.light.primaryForeground
              : tinted
                ? tintColor
                : COLORS.light.iconMuted
          }
          size={18}
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    );
  };
  return (
    <View style={styles.buttons}>
      {button(
        'not-taken',
        X,
        labels.notTaken,
        styles.notTaken,
        styles.notTakenTint,
        COLORS.light.textSecondary
      )}
      {button(
        'taken',
        Check,
        labels.taken,
        styles.taken,
        styles.takenTint,
        COLORS.light.primary
      )}
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
  // Lighter than the selected answers, for a group answered both ways.
  takenTint: {
    backgroundColor: COLORS.light.emptyIconContainer,
  },
  notTakenTint: {
    backgroundColor: COLORS.light.pillBorder,
  },
  disabled: {
    opacity: 0.4,
  },
});
