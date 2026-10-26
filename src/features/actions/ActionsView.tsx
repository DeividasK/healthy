import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowUpDown,
  Check,
  ClipboardList,
  Clock,
  Copy,
  Group,
  Pill,
  type LucideIcon,
} from 'lucide-react-native';
import Animated, {
  ReduceMotion,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceSection } from '@/src/components/ResourceSection';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import type { JournalOrder } from '@/src/features/settings/profileSettings';
import { saveProfileSettings } from '@/src/features/settings/profileSettingsRepository';
import { COLORS } from '@/src/theme/colors';
import { ActionDayPills } from './ActionDayPills';
import { ActionCalendar } from './ActionCalendar';
import { TreatmentLogRow, type ReorderHandlers } from './TreatmentLogRow';
import { BundleLogRow } from './BundleLogRow';
import { ProcedureLogRow } from './ProcedureLogRow';
import type { ProcedureItem } from './procedureDays';
import { setProcedureDuration, setProcedureLog } from './procedureLogService';
import {
  getBundleChanges,
  groupActionDay,
  type JournalRow,
} from './bundleGrouping';
import {
  canMoveJournalRow,
  groupJournalRows,
  moveJournalRow,
  type JournalGroup,
} from './journalGroups';
import { useJournalBundles } from './useJournalBundles';
import { CheckboxRow } from './CheckboxRow';
import {
  getActionDays,
  setTreatmentLog,
  setTreatmentLogs,
} from './treatmentLogService';
import {
  addDays,
  getCopyableAnswers,
  getJournalDays,
  todayKey,
  type ActionDay,
  type ActionItem,
  type TreatmentLogAnswer,
} from './actionDays';
import { CONTENT_COLUMN } from '@/src/theme/layout';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// A later day's rows come in from the right, an earlier day's from the left.
const ROWS_SLIDE_MS = 300;
const rowsSlide = {
  laterIn: SlideInRight.duration(ROWS_SLIDE_MS).reduceMotion(
    ReduceMotion.System
  ),
  laterOut: SlideOutLeft.duration(ROWS_SLIDE_MS).reduceMotion(
    ReduceMotion.System
  ),
  earlierIn: SlideInLeft.duration(ROWS_SLIDE_MS).reduceMotion(
    ReduceMotion.System
  ),
  earlierOut: SlideOutRight.duration(ROWS_SLIDE_MS).reduceMotion(
    ReduceMotion.System
  ),
};

/** Logs, day by day, whether each treatment was taken. */
export function ActionsView() {
  const params = useLocalSearchParams<{ date?: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const today = todayKey();
  // Future days cannot be logged; an invalid date falls back to today.
  const selected =
    params.date && DATE_KEY.test(params.date) && params.date <= today
      ? params.date
      : today;
  return (
    <ActionsForPatient
      key={activePatientId}
      activePatientId={activePatientId}
      isPatientLoading={isLoading}
      selected={selected}
      today={today}
    />
  );
}

function ActionsForPatient({
  activePatientId,
  isPatientLoading,
  selected,
  today,
}: {
  activePatientId: string;
  isPatientLoading: boolean;
  selected: string;
  today: string;
}) {
  const router = useRouter();

  const [daysByDate, setDaysByDate] = useState<Record<string, ActionDay>>({});
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [loadedPatientId, setLoadedPatientId] = useState('');
  const [hasLoadError, setHasLoadError] = useState(false);
  const [savingKeys, setSavingKeys] = useState<string[]>([]);
  const [saveErrorsByDate, setSaveErrorsByDate] = useState<
    Record<string, string | undefined>
  >({});
  // Answers copied from the previous day into each day it was checked for,
  // by item key. Each day starts unchecked.
  const [copiesByDate, setCopiesByDate] = useState<
    Record<string, Record<string, TreatmentLogAnswer>>
  >({});
  // Bumped by each refresh, so loads started before it are dropped.
  const generation = useRef(0);
  // Days being loaded in this generation, so they are not asked for twice.
  const pendingDates = useRef(new Set<string>());
  const hasLoaded = useRef(false);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  /**
   * Loads days the journal does not have yet, batch by batch, adding them to
   * those loaded. Stepping between loaded days loads nothing.
   */
  const loadMissingDays = useCallback(
    async (batches: string[][]) => {
      const started = generation.current;
      for (const date of batches.flat()) pendingDates.current.add(date);
      try {
        for (const dates of batches) {
          if (started !== generation.current) return;
          if (!dates.length) continue;
          const loaded = await getActionDays(activePatientId, dates);
          if (started !== generation.current) return;
          hasLoaded.current = true;
          setDaysByDate((current) => ({
            ...current,
            ...Object.fromEntries(loaded.map((day) => [day.date, day])),
          }));
          setHasLoadError(false);
          setLoadedPatientId(activePatientId);
        }
      } catch (err) {
        if (started !== generation.current) return;
        console.error('Failed to load actions:', err);
        setHasLoadError(true);
      } finally {
        if (started === generation.current)
          for (const date of batches.flat()) pendingDates.current.delete(date);
      }
    },
    [activePatientId]
  );

  // The selected day and its neighbours first, then the rest of the strip.
  useEffect(() => {
    if (!activePatientId || hasLoadError) return;
    const { nearby, strip } = getJournalDays(selected, today);
    const isMissing = (date: string) =>
      !(date in daysByDate) && !pendingDates.current.has(date);
    const batches = [nearby.filter(isMissing), strip.filter(isMissing)];
    if (batches.some((dates) => dates.length)) void loadMissingDays(batches);
  }, [
    activePatientId,
    daysByDate,
    hasLoadError,
    loadMissingDays,
    selected,
    today,
  ]);

  /**
   * Reloads the journal's days after its data changes. Days loaded for
   * earlier selections are dropped rather than reloaded; they load again when
   * needed.
   */
  const loadData = useCallback(async () => {
    if (!activePatientId) return;
    // Before the first load, the load above is under way, or failed: clearing
    // the error starts it again.
    if (!hasLoaded.current) {
      setHasLoadError(false);
      return;
    }
    const started = ++generation.current;
    pendingDates.current.clear();
    const { nearby, strip } = getJournalDays(selectedRef.current, today);
    try {
      const loaded = await getActionDays(activePatientId, [
        ...nearby,
        ...strip,
      ]);
      if (started !== generation.current) return;
      setDaysByDate(
        Object.fromEntries(
          loaded.map((loadedDay) => [loadedDay.date, loadedDay])
        )
      );
      setHasLoadError(false);
      setLoadedPatientId(activePatientId);
    } catch (err) {
      if (started !== generation.current) return;
      console.error('Failed to load actions:', err);
      setHasLoadError(true);
    }
  }, [activePatientId, today]);

  const journalBundles = useJournalBundles(activePatientId);

  const loadCalendarDays = useCallback(
    (dates: string[]) => getActionDays(activePatientId, dates),
    [activePatientId]
  );

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    [
      'medication_requests',
      'medication_administrations',
      'medication_statements',
      'service_requests',
      'procedures',
    ],
    loadData
  );

  // The day whose rows are shown, which follows the selected one a commit
  // later: the outgoing rows first learn which way to slide out, and stop
  // taking answers, which would otherwise be saved for the new day.
  const [shown, setShown] = useState<{
    date: string;
    isLater: boolean | null;
  }>({ date: selected, isLater: null });
  const isLeaving = selected !== shown.date;
  useEffect(() => {
    if (!isLeaving) return;
    // A separate commit, so the outgoing rows slide out with it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown({ date: selected, isLater: selected > shown.date });
  }, [isLeaving, selected, shown.date]);
  const isLeavingForLater = isLeaving ? selected > shown.date : shown.isLater;
  const shownDay = daysByDate[shown.date];

  const day = daysByDate[selected];
  const isLoading =
    isPatientLoading ||
    (!hasLoadError &&
      (loadedPatientId !== activePatientId || !day || !journalBundles));
  const shownRows = shownDay
    ? groupActionDay(
        shownDay.items,
        journalBundles?.bundles ?? [],
        journalBundles?.timesOfDay ?? {},
        shownDay.procedures
      )
    : [];

  // While the journal is reordered, rows move instead of taking answers.
  // Moves show at once and save one after another; until the last is saved
  // and reloaded, the order shown is the one moved to.
  const [isReordering, setIsReordering] = useState(false);
  const [movedOrder, setMovedOrder] = useState<JournalOrder | null>(null);
  const [orderSavesPending, setOrderSavesPending] = useState(0);
  const orderSaves = useRef(Promise.resolve());
  const queueOrderSave = useCallback((save: () => Promise<void>) => {
    orderSaves.current = orderSaves.current.then(save);
  }, []);
  const journalOrder =
    (orderSavesPending > 0 && movedOrder) || journalBundles?.journalOrder || {};
  const groups = groupJournalRows(
    shownRows,
    journalBundles?.timesOfDay ?? {},
    journalOrder
  );
  // A day without times keeps a list of treatments, and one of procedures
  // and activities.
  const isGrouped = groups.some((group) => group.id !== 'any');
  const sections: {
    key: string;
    icon: LucideIcon;
    title: string;
    testID: string;
    group: JournalGroup;
  }[] = isGrouped
    ? groups.map((group) => ({
        key: group.id,
        icon: Clock,
        title: group.label,
        testID: `actions-group-${group.id}`,
        group,
      }))
    : groups.flatMap((group) => {
        const procedures = group.rows.filter((row) => row.kind === 'procedure');
        const treatments = group.rows.filter((row) => row.kind !== 'procedure');
        return [
          {
            key: 'treatments',
            icon: Pill,
            title: 'Treatments',
            testID: 'actions-treatments-section',
            group: { ...group, rows: treatments },
          },
          {
            key: 'procedures',
            icon: ClipboardList,
            title: 'Procedures & activities',
            testID: 'actions-procedures-section',
            group: { ...group, rows: procedures },
          },
        ].filter((section) => section.group.rows.length > 0);
      });
  const canReorder = sections.some(
    ({ group }) => group.rows.length > 0 && canMoveJournalRow(group.rows, 0, 1)
  );

  const moveRow = (group: JournalGroup, index: number, delta: -1 | 1) => {
    const next: JournalOrder = {
      ...journalOrder,
      [group.id]: moveJournalRow(
        group.rows,
        index,
        delta,
        journalOrder[group.id]
      ),
    };
    const date = selected;
    setMovedOrder(next);
    setOrderSavesPending((count) => count + 1);
    const reload = journalBundles?.reload;
    queueOrderSave(async () => {
      try {
        await saveProfileSettings(activePatientId, { journalOrder: next });
        await reload?.();
      } catch (err) {
        console.error('Failed to save journal order:', err);
        setSaveErrorsByDate((current) => ({
          ...current,
          [date]: 'Failed to save the order. Please try again.',
        }));
      } finally {
        setOrderSavesPending((count) => count - 1);
      }
    });
  };

  const handleAnswer = async (
    item: ActionItem,
    answer: TreatmentLogAnswer | null
  ) => {
    if (!day) return;
    setSaveErrorsByDate((current) => ({ ...current, [day.date]: undefined }));
    setSavingKeys((keys) => [...keys, item.key]);
    // Show the answer at once; the reload after saving confirms it.
    setDaysByDate((current) => ({
      ...current,
      [day.date]: {
        ...current[day.date],
        items: current[day.date].items.map((candidate) =>
          candidate.key === item.key ? { ...candidate, answer } : candidate
        ),
      },
    }));
    try {
      await setTreatmentLog(item, day.date, answer, activePatientId);
    } catch (err) {
      console.error('Failed to save treatment log:', err);
      setSaveErrorsByDate((current) => ({
        ...current,
        [day.date]: 'Failed to save treatment answer. Please try again.',
      }));
    } finally {
      setSavingKeys((keys) => keys.filter((key) => key !== item.key));
      await loadData();
    }
  };

  /** Shows a procedure's change at once; the reload after saving confirms it. */
  const updateProcedure = (
    date: string,
    item: ProcedureItem,
    change: Partial<ProcedureItem>
  ) =>
    setDaysByDate((current) => ({
      ...current,
      [date]: {
        ...current[date],
        procedures: current[date].procedures?.map((candidate) =>
          candidate.key === item.key ? { ...candidate, ...change } : candidate
        ),
      },
    }));

  const saveProcedure = async (
    item: ProcedureItem,
    change: Partial<ProcedureItem>,
    save: (date: string) => Promise<void>
  ) => {
    if (!day) return;
    const date = day.date;
    setSaveErrorsByDate((current) => ({ ...current, [date]: undefined }));
    setSavingKeys((keys) => [...keys, item.key]);
    updateProcedure(date, item, change);
    try {
      await save(date);
    } catch (err) {
      console.error('Failed to save procedure log:', err);
      setSaveErrorsByDate((current) => ({
        ...current,
        [date]: 'Failed to save the answer. Please try again.',
      }));
    } finally {
      setSavingKeys((keys) => keys.filter((key) => key !== item.key));
      await loadData();
    }
  };

  const handleProcedureAnswer = (
    item: ProcedureItem,
    answer: TreatmentLogAnswer | null
  ) =>
    saveProcedure(item, { answer }, (date) =>
      setProcedureLog(item, date, answer, activePatientId)
    );

  const handleProcedureDuration = (
    item: ProcedureItem,
    minutes: number | null
  ) =>
    saveProcedure(item, { duration: minutes }, (date) =>
      setProcedureDuration(item, date, minutes, activePatientId)
    );

  const previousDay = daysByDate[addDays(selected, -1)];
  const copyable = day ? getCopyableAnswers(day, previousDay) : [];

  /**
   * Shows several answers at once, then saves them together: one
   * transaction and one refresh.
   */
  const applyAnswers = useCallback(
    async (
      date: string,
      changes: { item: ActionItem; answer: TreatmentLogAnswer | null }[],
      kind: 'copy' | 'bundle' = 'copy'
    ) => {
      if (!changes.length) return;
      setSaveErrorsByDate((current) => ({ ...current, [date]: undefined }));
      const keys = changes.map(({ item }) => item.key);
      const answers = new Map(
        changes.map(({ item, answer }) => [item.key, answer])
      );
      setDaysByDate((current) => ({
        ...current,
        [date]: {
          ...current[date],
          items: current[date].items.map((item) =>
            answers.has(item.key)
              ? { ...item, answer: answers.get(item.key) ?? null }
              : item
          ),
        },
      }));
      setSavingKeys((current) => [...current, ...keys]);
      try {
        await setTreatmentLogs(changes, date, activePatientId);
      } catch (err) {
        console.error(
          kind === 'copy'
            ? 'Failed to copy treatment logs:'
            : 'Failed to save bundle answers:',
          err
        );
        setSaveErrorsByDate((current) => ({
          ...current,
          [date]:
            kind === 'copy'
              ? 'Failed to copy treatment answers. Please try again.'
              : 'Failed to save treatment answers. Please try again.',
        }));
      } finally {
        setSavingKeys((current) =>
          current.filter((key) => !keys.includes(key))
        );
        await loadData();
      }
    },
    [activePatientId, loadData]
  );

  /**
   * Checking fills this day's unanswered rows with the previous day's
   * answers, never replacing one already given; they stay editable.
   * Unchecking clears the copies not changed since.
   */
  const handleCopyChange = (checked: boolean) => {
    if (!day) return;
    const copies = copiesByDate[selected] ?? {};
    const changes: { item: ActionItem; answer: TreatmentLogAnswer | null }[] =
      checked
        ? copyable.filter(({ item }) => !item.answer)
        : day.items.flatMap((item) =>
            item.answer && copies[item.key] === item.answer
              ? [{ item, answer: null }]
              : []
          );
    setCopiesByDate(({ [selected]: _previous, ...others }) =>
      checked
        ? {
            ...others,
            [selected]: Object.fromEntries(
              changes.map(({ item, answer }) => [item.key, answer!])
            ),
          }
        : others
    );
    void applyAnswers(selected, changes);
  };

  const openTreatment = (item: ActionItem) =>
    router.push({
      pathname: '/treatment/[id]',
      params: { id: item.treatment.id || '' },
    });

  const renderRow = (row: JournalRow, group: JournalGroup, index: number) => {
    const reorder: ReorderHandlers | undefined = isReordering
      ? {
          onMoveUp: canMoveJournalRow(group.rows, index, -1)
            ? () => moveRow(group, index, -1)
            : undefined,
          onMoveDown: canMoveJournalRow(group.rows, index, 1)
            ? () => moveRow(group, index, 1)
            : undefined,
        }
      : undefined;
    if (row.kind === 'procedure')
      return (
        <ProcedureLogRow
          key={row.item.key}
          item={row.item}
          isLeaving={isLeaving}
          disabled={isLeaving || savingKeys.includes(row.item.key)}
          reorder={reorder}
          onAnswer={(answer) => void handleProcedureAnswer(row.item, answer)}
          onDurationChange={(minutes) =>
            void handleProcedureDuration(row.item, minutes)
          }
          onOpen={() =>
            router.push({
              pathname: '/service-request/[id]',
              params: { id: row.item.request.id || '' },
            })
          }
        />
      );
    return row.kind === 'bundle' ? (
      <BundleLogRow
        key={row.key}
        row={row}
        isLeaving={isLeaving}
        isSaving={(item) => savingKeys.includes(item.key)}
        reorder={reorder}
        onAnswerAll={(pressed) =>
          void applyAnswers(
            shown.date,
            getBundleChanges(row.items, pressed),
            'bundle'
          )
        }
        onAnswer={(item, answer) => void handleAnswer(item, answer)}
        onOpen={() =>
          router.push({
            pathname: '/bundle/[id]',
            params: { id: row.bundle.id || '' },
          })
        }
        onOpenTreatment={openTreatment}
      />
    ) : (
      <TreatmentLogRow
        key={row.item.key}
        item={row.item}
        isLeaving={isLeaving}
        underTimeHeading={group.id !== 'any'}
        disabled={isLeaving || savingKeys.includes(row.item.key)}
        reorder={reorder}
        onAnswer={(answer) => void handleAnswer(row.item, answer)}
        onOpen={() => openTreatment(row.item)}
      />
    );
  };

  const selectDay = (date: string) => {
    router.setParams({ date: date === today ? undefined : date });
  };

  const handleDone = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['left', 'right', 'bottom']}
      testID="actions-view"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <ActionDayPills
          daysByDate={daysByDate}
          selected={selected}
          today={today}
          onSelect={selectDay}
          onOpenCalendar={() => setIsCalendarOpen(true)}
          keysEnabled={!isCalendarOpen}
          leading={
            copyable.length > 0 &&
            !isReordering && (
              <CheckboxRow
                testID="actions-copy-previous-day"
                label="Copy answers from previous day"
                icon={Copy}
                checked={selected in copiesByDate}
                onChange={handleCopyChange}
              />
            )
          }
        />
        {saveErrorsByDate[selected] && (
          <FormErrorBanner
            message={saveErrorsByDate[selected]}
            testID="actions-save-error"
          />
        )}
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        ) : hasLoadError ? (
          <Text style={styles.errorText}>Failed to load treatments.</Text>
        ) : (
          // A plain parent: when a day still loading replaces the rows, they
          // leave without sliding out (and without their test IDs twice).
          <View>
            {groups.length > 0 && (
              <Animated.View
                key={shown.date}
                entering={
                  shown.isLater === null
                    ? undefined
                    : shown.isLater
                      ? rowsSlide.laterIn
                      : rowsSlide.earlierIn
                }
                exiting={
                  isLeavingForLater === false
                    ? rowsSlide.earlierOut
                    : rowsSlide.laterOut
                }
                pointerEvents={isLeaving ? 'none' : 'auto'}
                aria-hidden={isLeaving}
                importantForAccessibility={
                  isLeaving ? 'no-hide-descendants' : 'auto'
                }
              >
                {sections.map(({ key, icon, title, testID, group }) => (
                  <ResourceSection
                    key={key}
                    icon={icon}
                    title={title}
                    testID={isLeaving ? undefined : testID}
                  >
                    {group.rows.map((row, index) =>
                      renderRow(row, group, index)
                    )}
                  </ResourceSection>
                ))}
              </Animated.View>
            )}
          </View>
        )}
      </ScrollView>
      {isCalendarOpen && (
        <ActionCalendar
          selected={selected}
          today={today}
          loadDays={loadCalendarDays}
          onSelect={selectDay}
          onClose={() => setIsCalendarOpen(false)}
        />
      )}
      <ResourceActionDock
        actions={
          isReordering
            ? [
                {
                  label: 'Done reordering',
                  testID: 'actions-reorder-done-button',
                  icon: Check,
                  onPress: () => setIsReordering(false),
                  primary: true,
                },
              ]
            : [
                {
                  label: 'Done',
                  testID: 'actions-done-button',
                  icon: Check,
                  onPress: handleDone,
                  primary: true,
                },
                {
                  label: 'New bundle',
                  testID: 'actions-new-bundle-button',
                  icon: Group,
                  onPress: () => router.push('/bundle/add'),
                },
                {
                  label: 'Reorder',
                  testID: 'actions-reorder-button',
                  icon: ArrowUpDown,
                  onPress: () => setIsReordering(true),
                  disabled: !canReorder,
                },
              ]
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    ...CONTENT_COLUMN,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 132,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
});
