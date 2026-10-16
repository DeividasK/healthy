import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Pill } from 'lucide-react-native';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceSection } from '@/src/components/ResourceSection';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { ActionDayPills } from './ActionDayPills';
import { TreatmentLogRow } from './TreatmentLogRow';
import { getActionDays, setTreatmentLog } from './treatmentLogService';
import {
  formatActionsHeading,
  getDayWindow,
  todayKey,
  type ActionDay,
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
  const dayWindow = getDayWindow(selected, today);

  const [days, setDays] = useState<ActionDay[]>([]);
  const [loadedPatientId, setLoadedPatientId] = useState('');
  const [hasLoadError, setHasLoadError] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    if (!activePatientId) return;
    const sequence = ++loadSequence.current;
    try {
      const loaded = await getActionDays(
        activePatientId,
        getDayWindow(selected, today)
      );
      if (sequence !== loadSequence.current) return;
      setDays(loaded);
      setHasLoadError(false);
      setLoadedPatientId(activePatientId);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load actions:', err);
      setHasLoadError(true);
    }
  }, [activePatientId, selected, today]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['medication_requests', 'medication_administrations'],
    loadData
  );

  const day = days.find((candidate) => candidate.date === selected);
  const isLoading =
    isPatientLoading ||
    (!hasLoadError && (loadedPatientId !== activePatientId || !day));

  const handleAnswer = async (
    treatmentId: string,
    answer: TreatmentLogAnswer | null
  ) => {
    const treatment = day?.treatments.find((t) => t.id === treatmentId);
    if (!day || !treatment) return;
    setSavingIds((ids) => [...ids, treatmentId]);
    // Show the answer at once; the reload after saving confirms it.
    setDays((current) =>
      current.map((candidate) => {
        if (candidate.date !== day.date) return candidate;
        const answers = { ...candidate.answers };
        if (answer) answers[treatmentId] = answer;
        else delete answers[treatmentId];
        return { ...candidate, answers };
      })
    );
    try {
      await setTreatmentLog(
        treatment,
        day.date,
        answer,
        activePatientId,
        day.logs[treatmentId]
      );
    } catch (err) {
      console.error('Failed to save treatment log:', err);
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== treatmentId));
      await loadData();
    }
  };

  const selectDay = (date: string) =>
    router.setParams({ date: date === today ? undefined : date });

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
          days={days.length ? days : dayWindow.map(emptyDay)}
          selected={selected}
          today={today}
          onSelect={selectDay}
        />
        <ScreenHeading testID="actions-heading">
          {formatActionsHeading(selected, today)}
        </ScreenHeading>
        {isLoading ? (
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        ) : hasLoadError ? (
          <Text style={styles.errorText}>Failed to load treatments.</Text>
        ) : (
          <ResourceSection
            icon={Pill}
            title="Treatments"
            testID="actions-treatments-section"
          >
            {day?.treatments.map((treatment) => (
              <TreatmentLogRow
                key={treatment.id}
                treatment={treatment}
                answer={day.answers[treatment.id || ''] ?? null}
                disabled={savingIds.includes(treatment.id || '')}
                onAnswer={(answer) =>
                  void handleAnswer(treatment.id || '', answer)
                }
              />
            ))}
          </ResourceSection>
        )}
      </ScrollView>
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

const emptyDay = (date: string): ActionDay => ({
  date,
  treatments: [],
  answers: {},
  logs: {},
});

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
