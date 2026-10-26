import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Group,
  ListChecks,
  Pill,
} from 'lucide-react-native';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import {
  formatBundleTime,
  getBundleTitle,
} from '@/src/features/bundles/bundleModel';
import { formatTreatmentCount } from '@/src/features/bundles/BundleRelatedRow';
import { COLORS } from '@/src/theme/colors';
import type { ActionItem, TreatmentLogAnswer } from './actionDays';
import { AnswerButtons, ReorderButtons } from './AnswerButtons';
import { getBundleAnswer, type BundleRow } from './bundleGrouping';
import { TreatmentLogRow, type ReorderHandlers } from './TreatmentLogRow';

/**
 * One time of a bundle in the journal: its buttons answer every dose it
 * groups. The chevron shows the doses, each with its own buttons; the row
 * opens the bundle. Closed on every day until toggled; once every dose is
 * answered both ways, both buttons are tinted. While the
 * journal is reordered, move buttons replace the chevron and answers, and
 * the doses stay hidden.
 */
export function BundleLogRow({
  row,
  isLeaving = false,
  isSaving,
  reorder,
  onAnswerAll,
  onAnswer,
  onOpen,
  onOpenTreatment,
}: {
  row: BundleRow;
  isLeaving?: boolean;
  isSaving: (item: ActionItem) => boolean;
  /** Set while the journal is reordered. */
  reorder?: ReorderHandlers;
  onAnswerAll: (answer: TreatmentLogAnswer) => void;
  onAnswer: (item: ActionItem, answer: TreatmentLogAnswer | null) => void;
  onOpen: () => void;
  onOpenTreatment: (item: ActionItem) => void;
}) {
  const [isToggled, setToggled] = useState(false);
  const title = getBundleTitle(row.bundle);
  const answer = getBundleAnswer(row.items);
  const answered = row.items.filter((item) => item.answer);
  const taken = row.items.filter((item) => item.answer === 'taken').length;
  const isMixed = answered.length > 0 && !answer;
  const isOpen = !reorder && isToggled;
  const treatmentCount = new Set(row.items.map((item) => item.treatment.id))
    .size;
  const testID = (name: string) =>
    isLeaving ? undefined : `bundle-log-${name}-${row.key}`;
  // The time is left out: the journal's group heading already shows it.
  const meta: ResourceMeta[] = [
    isMixed
      ? {
          icon: ListChecks,
          text: `${taken} of ${row.items.length} taken`,
          testID: testID('progress'),
        }
      : {
          icon: Pill,
          text: formatTreatmentCount(treatmentCount),
          testID: testID('count'),
        },
  ];
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
                accessibilityLabel={`${isOpen ? 'Hide' : 'Show'} treatments in ${name}`}
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
                mixed={isMixed && answered.length === row.items.length}
                name={name}
                disabled={isLeaving || row.items.some(isSaving)}
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
              disabled={isLeaving || isSaving(item)}
              onAnswer={(next) => onAnswer(item, next)}
              onOpen={() => onOpenTreatment(item)}
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
