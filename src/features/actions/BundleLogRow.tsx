import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp, Group, ListChecks } from 'lucide-react-native';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import {
  formatBundleTime,
  getBundleTitle,
} from '@/src/features/bundles/bundleModel';
import { getMemberCountMeta } from '@/src/features/bundles/BundleRelatedRow';
import { COLORS } from '@/src/theme/colors';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';
import { AnswerButtons, ReorderButtons } from './AnswerButtons';
import { getBundleAnswer, type BundleRow } from './bundleGrouping';
import { ProcedureLogRow } from './ProcedureLogRow';
import type { ProcedureItem } from './procedureDays';
import { TreatmentLogRow, type ReorderHandlers } from './TreatmentLogRow';

/**
 * One time of a bundle in the journal: its buttons answer every dose and
 * activity it groups. The chevron shows them, each with its own buttons; the
 * row opens the bundle. Closed on every day until toggled; once every one is
 * answered both ways, both buttons are tinted. While the journal is
 * reordered, move buttons replace the chevron and answers, and the members
 * stay hidden.
 */
export function BundleLogRow({
  row,
  isLeaving = false,
  isSaving,
  reorder,
  onAnswerAll,
  onAnswer,
  onProcedureAnswer,
  onProcedureDuration,
  onOpen,
  onOpenTreatment,
  onOpenProcedure,
}: {
  row: BundleRow;
  isLeaving?: boolean;
  isSaving: (item: { key: string }) => boolean;
  /** Set while the journal is reordered. */
  reorder?: ReorderHandlers;
  onAnswerAll: (answer: TreatmentLogAnswer) => void;
  onAnswer: (item: ActionItem, answer: TreatmentLogAnswer | null) => void;
  onProcedureAnswer: (
    item: ProcedureItem,
    answer: TreatmentLogAnswer | null
  ) => void;
  onProcedureDuration: (item: ProcedureItem, minutes: number | null) => void;
  onOpen: () => void;
  onOpenTreatment: (item: ActionItem) => void;
  onOpenProcedure: (item: ProcedureItem) => void;
}) {
  const [isToggled, setToggled] = useState(false);
  const title = getBundleTitle(row.bundle);
  const entries = [...row.items, ...row.procedures];
  const answer = getBundleAnswer(entries);
  const answered = entries.filter((item) => item.answer);
  const taken = entries.filter((item) => item.answer === 'taken').length;
  const isMixed = answered.length > 0 && !answer;
  const isOpen = !reorder && isToggled;
  const treatmentCount = new Set(row.items.map((item) => item.treatment.id))
    .size;
  const testID = (name: string) =>
    isLeaving ? undefined : `bundle-log-${name}-${row.key}`;
  const memberNoun = !row.procedures.length
    ? 'treatments'
    : row.items.length
      ? 'treatments and activities'
      : 'activities';
  // The time is left out: the journal's group heading already shows it.
  const meta: ResourceMeta[] = isMixed
    ? [
        {
          icon: ListChecks,
          text: `${taken} of ${entries.length} ${row.procedures.length ? 'done' : 'taken'}`,
          testID: testID('progress'),
        },
      ]
    : getMemberCountMeta(treatmentCount, row.procedures.length, {
        treatments: testID('count'),
        activities: testID('activity-count'),
      });
  const name = row.time ? `${title}, ${formatBundleTime(row.time)}` : title;
  const Chevron = isOpen ? ChevronUp : ChevronDown;

  return (
    <View testID={testID('group')}>
      <ResourceRow
        testID={testID('row')}
        title={title}
        typeIcon={Group}
        meta={meta}
        accessibilityLabel={`View bundle: ${title}`}
        onPress={onOpen}
        accessory={
          reorder ? (
            <ReorderButtons
              name={name}
              testIDSuffix={isLeaving ? undefined : row.key}
              {...reorder}
            />
          ) : (
            <View style={styles.accessory}>
              <TouchableOpacity
                testID={testID('toggle')}
                accessibilityRole="button"
                accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} ${memberNoun} in ${name}`}
                aria-expanded={isOpen}
                accessibilityState={{ expanded: isOpen }}
                style={styles.toggle}
                activeOpacity={0.6}
                onPress={() => setToggled(!isOpen)}
              >
                <Chevron color={COLORS.light.iconMuted} size={20} />
              </TouchableOpacity>
              <AnswerButtons
                answer={answer}
                mixed={isMixed && answered.length === entries.length}
                name={name}
                disabled={isLeaving || entries.some(isSaving)}
                testIDPrefix={
                  isLeaving
                    ? undefined
                    : { prefix: 'bundle-log', rowId: row.key }
                }
                onAnswer={(pressed) => onAnswerAll(pressed ?? answer!)}
              />
            </View>
          )
        }
      />
      {isOpen && (
        <View style={styles.members} testID={testID('members')}>
          {row.items.map((item) => (
            <TreatmentLogRow
              key={item.key}
              item={item}
              isLeaving={isLeaving}
              underTimeHeading={Boolean(row.time)}
              disabled={isLeaving || isSaving(item)}
              onAnswer={(next) => onAnswer(item, next)}
              onOpen={() => onOpenTreatment(item)}
            />
          ))}
          {row.procedures.map((item) => (
            <ProcedureLogRow
              key={item.key}
              item={item}
              isLeaving={isLeaving}
              disabled={isLeaving || isSaving(item)}
              onAnswer={(next) => onProcedureAnswer(item, next)}
              onDurationChange={(minutes) => onProcedureDuration(item, minutes)}
              onOpen={() => onOpenProcedure(item)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toggle: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  members: {
    marginLeft: 12,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.light.emptyIconContainer,
  },
});
