import { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getAllReports } from '@/src/features/lab-results/diagnosticReportService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { LabResultsSection } from '@/src/features/lab-results/LabResultsSection';
import {
  LabsSummary,
  latestBiomarkers,
  PERIODS,
  periodCutoff,
} from './LabsSummary';
import { useRangeDemographics } from '@/src/features/lab-results/useRangeDemographics';
import {
  BiomarkerSelectionContext,
  getBiomarkerRouteId,
} from './BiomarkerResultRow';
import { BiomarkerDetailView } from '@/src/features/lab-results/BiomarkerDetailView';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { COLORS } from '@/src/theme/colors';
import { WIDE_MAX_WIDTH, useIsWideLayout } from '@/src/theme/layout';

/**
 * Up and down arrows move through the biomarker list beside the detail
 * (web), choosing each biomarker they reach, unless a field has the keys.
 */
function useListArrowKeys(enabled: boolean) {
  // Only while this screen is in front: the stack keeps it mounted beneath
  // the screens opened from it.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !enabled) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select')) return;
        if (document.querySelector('[aria-modal="true"]')) return;
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            '#biomarker-list [aria-label^="View biomarker:"]'
          ),
        ];
        if (rows.length === 0) return;
        const current = rows.findIndex(
          (row) => row.getAttribute('aria-current') === 'true'
        );
        const next = Math.min(
          rows.length - 1,
          Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1))
        );
        event.preventDefault();
        rows[next].focus();
        rows[next].click();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [enabled])
  );
}

/** The active patient's latest biomarker results for the chosen period, then every lab result. */
export function LabsSummaryView() {
  const { period, biomarker, focus } = useLocalSearchParams<{
    period?: string;
    biomarker?: string;
    focus?: string;
  }>();
  const router = useRouter();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const isWideWindow = useIsWideLayout();
  const generation = useRef(0);
  const [data, setData] = useState({
    patientId: '',
    reports: [] as DiagnosticReportRecord[],
    isLoading: true,
    hasError: false,
  });
  const load = useCallback(async () => {
    if (isPatientLoading || !activePatientId) return;
    const request = ++generation.current;
    const patientId = activePatientId;
    setData({ patientId, reports: [], isLoading: true, hasError: false });
    try {
      const reports = await getAllReports(patientId);
      if (request !== generation.current) return;
      setData({ patientId, reports, isLoading: false, hasError: false });
    } catch (error) {
      if (request !== generation.current) return;
      console.error('Failed to load labs summary:', error);
      setData({ patientId, reports: [], isLoading: false, hasError: true });
    }
  }, [activePatientId, isPatientLoading]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        ++generation.current;
      };
    }, [load])
  );
  useDatabaseSubscription(['diagnostic_reports', 'observations'], load);
  const isCurrentPatient = data.patientId === activePatientId;
  const isLoading =
    isPatientLoading ||
    (!!activePatientId && (!isCurrentPatient || data.isLoading));

  const reports = useMemo(
    () => (isCurrentPatient && activePatientId ? data.reports : []),
    [isCurrentPatient, activePatientId, data.reports]
  );
  // The list's own filters, so the default is a row the list shows.
  const demographics = useRangeDemographics();
  const months = PERIODS.find(({ id }) => id === period)?.months ?? 0;
  // Desktop: the list stays on the left and the chosen biomarker shows on
  // the right, starting with the first one out of range.
  const firstId = useMemo(() => {
    const biomarkers = latestBiomarkers(
      reports,
      periodCutoff(months),
      demographics
    );
    const first =
      biomarkers.find(({ status }) => status === 'outOfRange') ?? biomarkers[0];
    return first && getBiomarkerRouteId(first.observation);
  }, [reports, months, demographics]);
  const selectedId = biomarker ?? firstId;
  const selection = useMemo(
    () => ({
      selectedId,
      onSelect: (id: string) => router.setParams({ biomarker: id }),
    }),
    [selectedId, router]
  );
  const isSplit = isWideWindow && !isLoading && Boolean(selectedId);
  useListArrowKeys(isSplit);

  const summary = (
    <LabsSummary
      key={`${activePatientId}:${period || 'all'}`}
      records={reports}
      showAll
      initialPeriod={period}
      autoFocusSearch={focus === 'search'}
    />
  );
  const labResults = (
    <View style={styles.labResults}>
      <LabResultsSection records={reports} />
    </View>
  );

  if (isSplit)
    return (
      // Related biomarkers on the right are chosen in place too.
      <BiomarkerSelectionContext.Provider value={selection}>
        <View style={styles.split} testID="labs-summary-view">
          <ScrollView
            nativeID="biomarker-list"
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            <ScreenHeading>Biomarkers</ScreenHeading>
            {summary}
            {labResults}
          </ScrollView>
          <View style={styles.detail}>
            <BiomarkerDetailView key={selectedId} id={selectedId} />
          </View>
          <ResourceActionDock actions={[]} />
        </View>
      </BiomarkerSelectionContext.Provider>
    );

  return (
    <ResourceViewLayout
      testID="labs-summary-view"
      title="Biomarkers"
      isLoading={isLoading}
      error={
        isCurrentPatient && data.hasError
          ? 'Unable to load lab results.'
          : undefined
      }
      actions={<ResourceActionDock actions={[]} />}
    >
      <View style={styles.content}>
        {summary}
        {labResults}
      </View>
    </ResourceViewLayout>
  );
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 800, alignSelf: 'flex-start' },
  split: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: WIDE_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: {
    width: 440,
    flexGrow: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.light.cardBorder,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 132 },
  detail: { flex: 1 },
  labResults: { marginTop: 32 },
});
