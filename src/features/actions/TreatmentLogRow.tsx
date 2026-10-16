import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, X, type LucideIcon } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { ResourceRow } from '@/src/components/ResourceSection';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import type { TreatmentLogAnswer } from './actionDays';

/**
 * A treatment with "not taken" (×) and "taken" (✓) buttons. Pressing the
 * selected button again clears the answer.
 */
export function TreatmentLogRow({
  treatment,
  answer,
  disabled = false,
  onAnswer,
}: {
  treatment: MedicationRequest;
  answer: TreatmentLogAnswer | null;
  disabled?: boolean;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
}) {
  const title = getTreatmentTitle(treatment);
  const id = treatment.id || '';
  const button = (
    value: TreatmentLogAnswer,
    Icon: LucideIcon,
    label: string,
    selectedStyle: object
  ) => {
    const selected = answer === value;
    return (
      <TouchableOpacity
        testID={`treatment-log-${value}-${id}`}
        accessibilityRole="checkbox"
        accessibilityLabel={`Mark ${title} ${label}`}
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
    <ResourceRow
      testID={`treatment-log-row-${id}`}
      title={title}
      accessory={
        <View style={styles.buttons}>
          {button('not-taken', X, 'not taken', styles.notTaken)}
          {button('taken', Check, 'taken', styles.taken)}
        </View>
      }
    />
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
});
