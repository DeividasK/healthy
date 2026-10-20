import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import type { RequestOrchestration } from 'fhir/r5';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getAllBundles } from '@/src/features/bundles/bundleService';
import { getProfileSettings } from '@/src/features/settings/profileSettingsRepository';
import {
  DEFAULT_TIMES_OF_DAY,
  type JournalOrder,
} from '@/src/features/settings/profileSettings';
import type { TimesOfDay } from './bundleGrouping';

/**
 * The profile's bundles, times of day and journal order, kept current for
 * the journal.
 */
export function useJournalBundles(patientId: string) {
  const [state, setState] = useState<{
    patientId: string;
    bundles: RequestOrchestration[];
    timesOfDay: TimesOfDay;
    journalOrder: JournalOrder;
  } | null>(null);

  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    if (!patientId) return;
    const sequence = ++loadSequence.current;
    try {
      const [bundles, settings] = await Promise.all([
        getAllBundles(patientId),
        getProfileSettings(patientId),
      ]);
      if (sequence === loadSequence.current)
        setState({
          patientId,
          bundles,
          timesOfDay: settings.timesOfDay,
          journalOrder: settings.journalOrder ?? {},
        });
    } catch (err) {
      // The journal still works without its bundles.
      console.error('Failed to load bundles:', err);
      if (sequence === loadSequence.current)
        setState({
          patientId,
          bundles: [],
          timesOfDay: DEFAULT_TIMES_OF_DAY,
          journalOrder: {},
        });
    }
  }, [patientId]);

  useFocusEffect(useCallback(() => void load(), [load]));
  useDatabaseSubscription(
    ['request_orchestrations', 'profile_settings', 'medication_requests'],
    load
  );

  const current = state?.patientId === patientId ? state : null;
  return current && { ...current, reload: load };
}
