import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Check, Tablets, X, type LucideIcon } from 'lucide-react-native';
import { ResourceRow } from '@/src/components/ResourceSection';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';

/**
 * A treatment, or one scheduled dose of it, with "not taken" (×) and "taken"
 * (✓) buttons. Pressing the selected button again clears the answer.
 */
export function TreatmentLogRow({
  item,
  disabled = false,
  onAnswer,
  onOpen,
}: {
  item: ActionItem;
  disabled?: boolean;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
  /** Opens the treatment's page. */
  onOpen: () => void;
}) {
  const title = getTreatmentTitle(item.treatment);
  const name = item.dose ? `${title}, ${item.dose.text}` : title;
  const button = (
    value: TreatmentLogAnswer,
    Icon: LucideIcon,
    label: string,
    selectedStyle: object
  ) => {
    const selected = item.answer === value;
    return (
      <TouchableOpacity
        testID={`treatment-log-${value}-${item.rowId}`}
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
    <ResourceRow
      testID={`treatment-log-row-${item.rowId}`}
      title={title}
      meta={item.dose ? [{ icon: Tablets, text: item.dose.text }] : []}
      accessibilityLabel={`View treatment: ${title}`}
      onPress={onOpen}
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
