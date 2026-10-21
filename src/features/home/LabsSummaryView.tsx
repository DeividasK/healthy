import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getAllReports } from '@/src/features/lab-results/diagnosticReportService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { LabResultsSection } from '@/src/features/lab-results/LabResultsSection';
import { LabsSummary } from './LabsSummary';

/** The active patient's latest biomarker results for the chosen period, then every lab result. */
export function LabsSummaryView() {
  const { period } = useLocalSearchParams<{ period?: string }>();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
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
        <LabsSummary
          key={`${activePatientId}:${period || 'all'}`}
          records={isCurrentPatient && activePatientId ? data.reports : []}
          showAll
          initialPeriod={period}
        />
        <View style={styles.labResults}>
          <LabResultsSection
            records={isCurrentPatient && activePatientId ? data.reports : []}
          />
        </View>
      </View>
    </ResourceViewLayout>
  );
}
const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 800, alignSelf: 'flex-start' },
  labResults: { marginTop: 32 },
});
