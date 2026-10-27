import React from 'react';
import { Pill, Tablets, TriangleAlert } from 'lucide-react-native';
import { ResourceRow } from '@/src/components/ResourceSection';
import { formatDose } from '@/src/features/treatments/regimen';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';
import { AnswerButtons, ReorderButtons } from './AnswerButtons';

/**
 * A treatment, or one scheduled dose of it, with "not taken" (×) and "taken"
 * (✓) buttons. Pressing the selected button again clears the answer. While
 * the journal is reordered, move buttons take their place. Under a time
 * heading, the dose leaves out the time of day the heading already shows.
 */
export function TreatmentLogRow({
  item,
  disabled = false,
  isLeaving = false,
  underTimeHeading = false,
  reorder,
  onAnswer,
  onOpen,
}: {
  item: ActionItem;
  disabled?: boolean;
  /** Shown under a part of the day or clock time heading. */
  underTimeHeading?: boolean;
  /** Sliding out for another day's rows: a copy without test IDs. */
  isLeaving?: boolean;
  /** Set while the journal is reordered. */
  reorder?: ReorderHandlers;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
  /** Opens the treatment's page. */
  onOpen: () => void;
}) {
  const title = getTreatmentTitle(item.treatment);
  const name = item.dose ? `${title}, ${item.dose.text}` : title;
  const doseText =
    underTimeHeading && item.dose?.dosage
      ? formatDose(item.dose.dosage, { withoutTime: true })
      : item.dose?.text;
  return (
    <ResourceRow
      testID={isLeaving ? undefined : `treatment-log-row-${item.rowId}`}
      title={title}
      typeIcon={Pill}
      meta={[
        // What it was taken under, once that no longer matches.
        ...(item.takenAs || item.dose
          ? [{ icon: Tablets, text: item.takenAs ?? doseText! }]
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
        reorder ? (
          <ReorderButtons
            name={name}
            testIDSuffix={isLeaving ? undefined : item.rowId}
            {...reorder}
          />
        ) : (
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
        )
      }
    />
  );
}

/** Moves a journal row; a missing handler disables that direction. */
export interface ReorderHandlers {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}
