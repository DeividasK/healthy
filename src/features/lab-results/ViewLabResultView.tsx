import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlaskConical } from 'lucide-react-native';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { BiomarkerResultRow } from '@/src/features/home/BiomarkerResultRow';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { deleteReport, getReportById } from './diagnosticReportService';
import { isSupportedCBCObservation } from './biomarkerMeasurements';
import { getLabResultMeta, getLabResultTitle } from './labResultMeta';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

export function ViewLabResultView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ResourceViewLayout testID="lab-result-view" isLoading />;
  return (
    <LabResultForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function LabResultForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const [record, setRecord] = useState<DiagnosticReportRecord | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || !activePatientId) return;
    setHasLoadError(false);
    try {
      const loaded = await getReportById(id);
      if (sequence !== loadSequence.current) return;
      const isPatients =
        loaded?.report.subject?.reference === `Patient/${activePatientId}`;
      setNotFound(!isPatients);
      setRecord(isPatients ? loaded : null);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load lab result view data:', err);
      setHasLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['diagnostic_reports', 'observations', 'organizations'],
    loadData
  );

  if (isLoading) {
    return <ResourceViewLayout testID="lab-result-view" isLoading />;
  }

  if (hasLoadError || notFound || !record) {
    return (
      <ResourceViewLayout
        testID="lab-result-view"
        error={
          hasLoadError ? 'Failed to load lab result.' : 'Lab result not found.'
        }
      />
    );
  }

  const { report } = record;
  const notes = report.note
    ?.map((note) => note.text)
    .filter(Boolean)
    .join('\n');
  const results = record.observations.filter(isSupportedCBCObservation);

  return (
    <ResourceViewLayout
      testID="lab-result-view"
      title={getLabResultTitle(report)}
      titleTestID="lab-result-title"
      meta={getLabResultMeta(report, { withTestIDs: true })}
      actions={
        <ResourceActionDock
          editLabel="Edit lab result"
          onEdit={() => router.push(`/lab-result/${id}/edit`)}
          editTestID="edit-lab-result-button"
          deleteLabel="Delete lab result"
          deleteTestID="delete-lab-result-button"
          deleteConfirmation={{
            title: 'Delete Lab Result',
            message:
              'Are you sure you want to delete this lab result? This action cannot be undone.',
            onConfirm: async () => {
              await deleteReport(id);
              goBackOr(router, '/');
            },
          }}
        />
      }
    >
      {Boolean(notes) && (
        <View style={styles.details}>
          <ResourceTextSection
            title="Notes"
            text={notes!}
            testID="lab-result-notes-section"
            textTestID="lab-result-notes"
          />
        </View>
      )}

      <ResourceSection
        icon={FlaskConical}
        title="Results"
        count={results.length}
        testID="lab-result-results-section"
      >
        {results.map((observation) => (
          <View key={observation.id} style={styles.result}>
            <BiomarkerResultRow observation={observation} />
          </View>
        ))}
      </ResourceSection>
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 16,
    marginBottom: 28,
  },
  // Spaces results like resource rows, divided by the same hairline.
  result: {
    minHeight: 60,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
});
