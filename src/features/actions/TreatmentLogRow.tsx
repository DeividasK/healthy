import React from 'react';
import { Tablets, TriangleAlert } from 'lucide-react-native';
import { ResourceRow } from '@/src/components/ResourceSection';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';
import { AnswerButtons } from './AnswerButtons';

/**
 * A treatment, or one scheduled dose of it, with "not taken" (×) and "taken"
 * (✓) buttons. Pressing the selected button again clears the answer.
 */
export function TreatmentLogRow({
  item,
  disabled = false,
  isLeaving = false,
  onAnswer,
  onOpen,
}: {
  item: ActionItem;
  disabled?: boolean;
  /** Sliding out for another day's rows: a copy without test IDs. */
  isLeaving?: boolean;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
  /** Opens the treatment's page. */
  onOpen: () => void;
}) {
  const title = getTreatmentTitle(item.treatment);
  const name = item.dose ? `${title}, ${item.dose.text}` : title;
  return (
    <ResourceRow
      testID={isLeaving ? undefined : `treatment-log-row-${item.rowId}`}
      title={title}
      meta={[
        // What it was taken under, once that no longer matches.
        ...(item.takenAs || item.dose
          ? [{ icon: Tablets, text: item.takenAs ?? item.dose!.text }]
          : []),
        ...(item.mismatch
          ? [
              {
                icon: TriangleAlert,
                text: "Doesn't match the current regimen",
                tone: 'warning' as const,
                testID: isLeaving
                  ? undefined
                  : `treatment-log-mismatch-${item.rowId}`,
              },
            ]
          : []),
      ]}
      accessibilityLabel={`View treatment: ${title}`}
      onPress={onOpen}
      accessory={
        <AnswerButtons
          answer={item.answer}
          name={name}
          disabled={disabled}
          testIDPrefix={
            isLeaving
              ? undefined
              : { prefix: 'treatment-log', rowId: item.rowId }
          }
          onAnswer={onAnswer}
        />
      }
    />
  );
}
