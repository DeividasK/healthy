import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Copy, Pill } from 'lucide-react-native';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceSection } from '@/src/components/ResourceSection';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { ActionDayPills } from './ActionDayPills';
import { ActionCalendar } from './ActionCalendar';
import { TreatmentLogRow } from './TreatmentLogRow';
import { CheckboxRow } from './CheckboxRow';
import {
  getActionDays,
  setTreatmentLog,
  setTreatmentLogs,
} from './treatmentLogService';
import {
  addDays,
  getCopyableAnswers,
  daysEndingOn,
  STRIP_DAYS,
  todayKey,
  type ActionDay,
  type ActionItem,
  type TreatmentLogAnswer,
} from './actionDays';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

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
  // Answers copied from the previous day into each day it was checked for,
  // by item key. Each day starts unchecked.
  const [copiesByDate, setCopiesByDate] = useState<
    Record<string, Record<string, TreatmentLogAnswer>>
  >({});
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    if (!activePatientId) return;
    const sequence = ++loadSequence.current;
    try {
      // The recent days, and any strip around an older selection: every day
      // within 21 of it (including the day before, for copying answers).
      const dates = new Set(
        [
          ...daysEndingOn(today, STRIP_DAYS),
          ...daysEndingOn(addDays(selected, STRIP_DAYS), 2 * STRIP_DAYS + 1),
        ].filter((date) => date <= today)
      );
      const loaded = await getActionDays(activePatientId, [...dates]);
      if (sequence !== loadSequence.current) return;
      setDaysByDate((current) => {
        const next = { ...current };
        for (const loadedDay of loaded) next[loadedDay.date] = loadedDay;
        return next;
      });
      setHasLoadError(false);
      setLoadedPatientId(activePatientId);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load actions:', err);
      setHasLoadError(true);
    }
  }, [activePatientId, selected, today]);

  const loadCalendarDays = useCallback(
    (dates: string[]) => getActionDays(activePatientId, dates),
    [activePatientId]
  );

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['medication_requests', 'medication_administrations'],
    loadData
  );

  const day = daysByDate[selected];
  const isLoading =
    isPatientLoading ||
    (!hasLoadError && (loadedPatientId !== activePatientId || !day));

  const handleAnswer = async (
    item: ActionItem,
    answer: TreatmentLogAnswer | null
  ) => {
    if (!day) return;
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
    } finally {
      setSavingKeys((keys) => keys.filter((key) => key !== item.key));
      await loadData();
    }
  };

  const previousDay = daysByDate[addDays(selected, -1)];
  const copyable = day ? getCopyableAnswers(day, previousDay) : [];

  /**
   * Shows several answers at once, then saves them together: one
   * transaction and one refresh.
   */
  const applyAnswers = useCallback(
    async (
      date: string,
      changes: { item: ActionItem; answer: TreatmentLogAnswer | null }[]
    ) => {
      if (!changes.length) return;
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
        console.error('Failed to copy treatment logs:', err);
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
            copyable.length > 0 && (
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
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        ) : hasLoadError ? (
          <Text style={styles.errorText}>Failed to load treatments.</Text>
        ) : (
          <>
            <ResourceSection
              icon={Pill}
              title="Treatments"
              testID="actions-treatments-section"
            >
              {day?.items.map((item) => (
                <TreatmentLogRow
                  key={item.key}
                  item={item}
                  disabled={savingKeys.includes(item.key)}
                  onAnswer={(answer) => void handleAnswer(item, answer)}
                  onOpen={() =>
                    router.push({
                      pathname: '/treatment/[id]',
                      params: { id: item.treatment.id || '' },
                    })
                  }
                />
              ))}
            </ResourceSection>
          </>
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
        actions={[
          {
            label: 'Done',
            testID: 'actions-done-button',
            icon: Check,
            onPress: handleDone,
            primary: true,
          },
        ]}
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
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 132,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
});
