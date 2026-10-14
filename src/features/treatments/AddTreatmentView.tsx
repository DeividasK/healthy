import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TreatmentForm, type TreatmentFormValues } from './TreatmentForm';
import { createOrUpdateTreatment } from './treatmentService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { fetchClinicalDocumentByConsultationId } from '@/src/features/consultations/clinicalDocumentsRepository';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import type { Condition } from 'fhir/r5';
import { COLORS } from '@/src/theme/colors';

export function AddTreatmentView() {
  const { consultationId } = useLocalSearchParams<{
    consultationId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <AddTreatmentForPatient
      key={`${activePatientId}:${consultationId || ''}`}
      activePatientId={activePatientId}
      consultationId={consultationId}
    />
  );
}

function AddTreatmentForPatient({
  activePatientId,
  consultationId,
}: {
  activePatientId: string;
  consultationId?: string;
}) {
  const [documentState, setDocumentState] = useState<
    'loading' | 'existing' | 'new' | 'error'
  >('loading');
  const [conditions, setConditions] = useState<Condition[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      consultationId
        ? fetchClinicalDocumentByConsultationId(consultationId, activePatientId)
        : Promise.resolve(null),
      getAllConditions(activePatientId),
    ])
      .then(([doc, patientConditions]) => {
        if (cancelled) return;
        setConditions(patientConditions);
        setDocumentState(doc || !consultationId ? 'existing' : 'new');
      })
      .catch(() => {
        if (!cancelled) setDocumentState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId, activePatientId]);
  const { triggerSync } = useSync();
  const router = useRouter();

  if (documentState === 'error')
    return <Text>Failed to load treatment form.</Text>;
  if (documentState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  const handleSubmit = async (values: TreatmentFormValues) => {
    const formattedDate = values.authoredDate
      ? formatLocalDate(values.authoredDate)
      : undefined;
    const created = await createOrUpdateTreatment({
      title: values.title,
      intent: values.intent,
      status: values.status,
      authoredDate: formattedDate,
      dosageInstructions: values.dosageInstructions,
      reason: values.reason,
      reasonConditionId: values.reasonConditionId,
      notes: values.notes,
      patientId: activePatientId,
      consultationId: consultationId || undefined,
      documenterName: values.documenterName,
    });

    triggerSync().catch((err) =>
      console.warn('Background sync failed on add treatment:', err)
    );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    if (consultationId) {
      router.dismissTo(`/consultation/${consultationId}`);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/treatment/${created.id}`);
    }
  };

  return (
    <TreatmentForm
      onSubmit={handleSubmit}
      conditions={conditions}
      isEditing={false}
      requireDocumenter={documentState === 'new'}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
});
