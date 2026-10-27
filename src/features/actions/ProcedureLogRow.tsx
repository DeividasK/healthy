import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  CalendarClock,
  ClipboardList,
  ListChecks,
  type LucideIcon,
  Minus,
  Plus,
  Timer,
} from 'lucide-react-native';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { FormTextInput } from '@/src/components/FormField';
import {
  formatScheduleText,
  getScheduleRepeat,
} from '@/src/features/service-requests/serviceRequestSchedule';
import { parseLocalDate } from '@/src/utils/dateUtils';
import { getServiceRequestTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import type { TreatmentLogAnswer } from './actionDays';
import type { ProcedureItem } from './procedureDays';
import { AnswerButtons, ReorderButtons } from './AnswerButtons';
import type { ReorderHandlers } from './TreatmentLogRow';

/** Minutes the duration buttons step by. */
const DURATION_STEP = 5;

const PROCEDURE_LABELS = { taken: 'done', notTaken: 'not done' };

const formatShortDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

/** e.g. "Due Oct 14 – 28", "Due Oct 28 – Nov 11" or "Due from Oct 14". */
export function formatDueWindow(due: { from: string; to?: string }): string {
  const from = formatShortDate(due.from);
  if (!due.to || due.to === due.from) return `Due from ${from}`;
  const to =
    due.to.slice(0, 7) === due.from.slice(0, 7)
      ? String(Number(due.to.slice(8)))
      : formatShortDate(due.to);
  return `Due ${from} – ${to}`;
}

/**
 * The row's meta line: due window, session and, until done, the schedule
 * worded like a treatment's dose (e.g. "30 min, once a day"), without the
 * time of day under a time heading.
 */
export function getProcedureLogMeta(
  item: ProcedureItem,
  testID?: (name: string) => string | undefined,
  underTimeHeading = false
): ResourceMeta[] {
  const repeat = getScheduleRepeat(item.request);
  // Sessions are counted on their own meta item.
  const schedule =
    repeat &&
    formatScheduleText(
      { ...repeat, count: undefined },
      { withoutTime: underTimeHeading }
    );
  return [
    ...(item.due
      ? [
          {
            icon: CalendarClock,
            text: formatDueWindow(item.due),
            testID: testID?.('due'),
          },
        ]
      : []),
    ...(item.session
      ? [
          {
            icon: ListChecks,
            text: `Session ${item.session.number} of ${item.session.count}`,
            testID: testID?.('session'),
          },
        ]
      : []),
    ...(item.answer !== 'taken' && schedule
      ? [
          {
            icon: Timer,
            text: schedule,
            testID: testID?.('planned-duration'),
          },
        ]
      : []),
  ];
}

/**
 * A scheduled service request (a procedure or activity) in the journal, with
 * "not done" (×) and "done" (✓) buttons. Once done, its duration can be
 * recorded below, typed or stepped by 5 minutes.
 */
export function ProcedureLogRow({
  item,
  disabled = false,
  isLeaving = false,
  underTimeHeading = false,
  reorder,
  onAnswer,
  onDurationChange,
  onOpen,
}: {
  item: ProcedureItem;
  disabled?: boolean;
  /** Sliding out for another day's rows: a copy without test IDs. */
  isLeaving?: boolean;
  /** Shown under a part of the day or clock time heading. */
  underTimeHeading?: boolean;
  /** Set while the journal is reordered. */
  reorder?: ReorderHandlers;
  onAnswer: (answer: TreatmentLogAnswer | null) => void;
  onDurationChange: (minutes: number | null) => void;
  /** Opens the service request's page. */
  onOpen: () => void;
}) {
  const title = getServiceRequestTitle(item.request);
  const testID = (name: string) =>
    isLeaving ? undefined : `procedure-log-${name}-${item.rowId}`;
  return (
    <View testID={testID('item')}>
      <ResourceRow
        testID={testID('row')}
        title={title}
        typeIcon={ClipboardList}
        meta={getProcedureLogMeta(item, testID, underTimeHeading)}
        accessibilityLabel={`View service request: ${title}`}
        onPress={onOpen}
        accessory={
          reorder ? (
            <ReorderButtons
              name={title}
              testIDSuffix={isLeaving ? undefined : item.rowId}
              {...reorder}
            />
          ) : (
            <AnswerButtons
              answer={item.answer}
              name={title}
              disabled={disabled}
              labels={PROCEDURE_LABELS}
              testIDPrefix={
                isLeaving
                  ? undefined
                  : { prefix: 'procedure-log', rowId: item.rowId }
              }
              onAnswer={onAnswer}
            />
          )
        }
      />
      {item.answer === 'taken' && item.log && !reorder && (
        <DurationStepper
          // A new answer or a saved change starts the field over.
          key={`${item.key}:${item.duration}`}
          minutes={item.duration}
          name={title}
          inputID={`procedure-duration-${item.rowId}`}
          testID={testID('duration')}
          disabled={disabled}
          onChange={onDurationChange}
        />
      )}
    </View>
  );
}

/** Minutes typed or stepped by 5; saved on each step and when typing ends. */
function DurationStepper({
  minutes,
  name,
  inputID,
  testID,
  disabled,
  onChange,
}: {
  minutes: number | null;
  name: string;
  inputID: string;
  testID?: string;
  disabled: boolean;
  onChange: (minutes: number | null) => void;
}) {
  const [text, setText] = useState(minutes === null ? '' : String(minutes));
  const current = text.trim() ? Number(text) : null;
  const commit = (next: number | null) => {
    setText(next === null ? '' : String(next));
    if (next !== minutes) onChange(next);
  };
  const step = (delta: number) =>
    commit(Math.max(0, (Number.isFinite(current) ? current! : 0) + delta));
  const button = (
    label: string,
    Icon: LucideIcon,
    delta: number,
    suffix: string
  ) => (
    <TouchableOpacity
      testID={testID && `${testID}-${suffix}`}
      accessibilityRole="button"
      accessibilityLabel={`${label} for ${name}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={styles.stepButton}
      activeOpacity={0.6}
      onPress={() => step(delta)}
    >
      <Icon color={COLORS.light.iconMuted} size={18} strokeWidth={2.5} />
    </TouchableOpacity>
  );
  return (
    <View style={styles.duration} testID={testID}>
      <View style={styles.durationLabel}>
        <Timer color={COLORS.light.muted} size={16} />
        <Text style={styles.durationText} nativeID={`${inputID}-label`}>
          Duration
        </Text>
      </View>
      {button(`${DURATION_STEP} minutes less`, Minus, -DURATION_STEP, 'less')}
      <View style={styles.minutes}>
        <FormTextInput
          id={inputID}
          nativeID={inputID}
          name={inputID}
          testID={testID && `${testID}-input`}
          accessibilityLabel={`Minutes of ${name}`}
          aria-labelledby={`${inputID}-label`}
          keyboardType="number-pad"
          inputMode="numeric"
          editable={!disabled}
          value={text}
          onChangeText={(value) => setText(value.replace(/[^0-9]/g, ''))}
          onBlur={() => commit(current)}
          onSubmitEditing={() => commit(current)}
          style={styles.minutesInput}
        />
        <Text style={styles.durationText}>min</Text>
      </View>
      {button(`${DURATION_STEP} minutes more`, Plus, DURATION_STEP, 'more')}
    </View>
  );
}

const styles = StyleSheet.create({
  duration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
  },
  durationLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.pillBackground,
  },
  minutes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  minutesInput: {
    width: 64,
    height: 44,
    textAlign: 'right',
  },
});
