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
import {
  getConsultationById,
  getDistinctDoctorNames,
} from '@/src/features/consultations/consultationService';
import { getConsultationDoctor } from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import type { Condition } from 'fhir/r5';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

export function AddTreatmentView() {
  const { consultationId, conditionId } = useLocalSearchParams<{
    consultationId?: string;
    conditionId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <AddTreatmentForPatient
      key={`${activePatientId}:${consultationId || ''}:${conditionId || ''}`}
      activePatientId={activePatientId}
      consultationId={consultationId}
      conditionId={conditionId}
    />
  );
}

function AddTreatmentForPatient({
  activePatientId,
  consultationId,
  conditionId,
}: {
  activePatientId: string;
  consultationId?: string;
  /** Added from a condition, which starts out associated. */
  conditionId?: string;
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [specialists, setSpecialists] = useState<string[]>([]);
  // Added through a consultation, the treatment defaults to its specialist.
  const [consultationSpecialist, setConsultationSpecialist] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getAllConditions(activePatientId),
      getDistinctDoctorNames(activePatientId),
      consultationId
        ? getConsultationById(consultationId, activePatientId)
        : null,
    ])
      .then(([patientConditions, knownSpecialists, consultation]) => {
        if (cancelled) return;
        setConditions(patientConditions);
        setSpecialists(knownSpecialists);
        setConsultationSpecialist(
          (consultation && getConsultationDoctor(consultation)) || ''
        );
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId, activePatientId]);
  const { triggerSync } = useSync();
  const router = useRouter();

  if (loadState === 'error') return <Text>Failed to load treatment form.</Text>;
  if (loadState === 'loading') {
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
      reasonConditionIds: values.reasonConditionIds,
      notes: values.notes,
      patientId: activePatientId,
      consultationId: consultationId || undefined,
      requesterName: values.requesterName,
    });

    triggerSync().catch((err) =>
      console.warn('Background sync failed on add treatment:', err)
    );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    if (consultationId) {
      router.dismissTo(`/consultation/${consultationId}`);
    } else if (conditionId) {
      router.dismissTo(`/condition/${conditionId}`);
    } else {
      goBackOr(router, `/treatment/${created.id}`);
    }
  };

  return (
    <TreatmentForm
      onSubmit={handleSubmit}
      conditions={conditions}
      isEditing={false}
      initialValues={{
        requesterName: consultationSpecialist,
        reasonConditionIds: conditionId ? [conditionId] : [],
      }}
      specialistSuggestions={specialists}
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
