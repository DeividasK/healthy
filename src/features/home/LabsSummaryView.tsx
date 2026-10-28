import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import { useBiomarkerRanges } from '@/src/features/lab-results/useBiomarkerRanges';
import {
  BiomarkerSelectionContext,
  getBiomarkerRouteId,
} from './BiomarkerResultRow';
import { BiomarkerDetailView } from '@/src/features/lab-results/BiomarkerDetailView';
import { ListDetailLayout } from '@/src/components/ListDetailLayout';
import { useIsWideLayout } from '@/src/theme/layout';

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
  const ranges = useBiomarkerRanges();
  const months = PERIODS.find(({ id }) => id === period)?.months ?? 0;
  // Desktop: the list stays on the left and the chosen biomarker shows on
  // the right, starting with the first one out of range.
  const firstId = useMemo(() => {
    const biomarkers = latestBiomarkers(reports, periodCutoff(months), ranges);
    const first =
      biomarkers.find(({ status }) => status === 'outOfRange') ?? biomarkers[0];
    return first && getBiomarkerRouteId(first.observation);
  }, [reports, months, ranges]);
  const selectedId = biomarker ?? firstId;
  const selection = useMemo(
    () => ({
      selectedId,
      onSelect: (id: string) => router.setParams({ biomarker: id }),
    }),
    [selectedId, router]
  );
  const isSplit = isWideWindow && !isLoading && Boolean(selectedId);

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
        <ListDetailLayout
          title="Biomarkers"
          listId="biomarker-list"
          rowSelector='[aria-label^="View biomarker:"]'
          testID="labs-summary-view"
          list={
            <>
              {summary}
              {labResults}
            </>
          }
          // Not keyed by the biomarker: a remount would reload every report
          // and flash the skeleton on each step.
          detail={<BiomarkerDetailView id={selectedId} />}
          dock={<ResourceActionDock actions={[]} />}
        />
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
  labResults: { marginTop: 32 },
});
