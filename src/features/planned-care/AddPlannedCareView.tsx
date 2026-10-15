import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Text,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import type { Condition } from 'fhir/r5';
import { PlannedCareForm, type PlannedCareFormValues } from './PlannedCareForm';
import { createOrUpdatePlannedCare } from './plannedCareService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatLocalDate } from '@/src/utils/dateUtils';
import {
  getConsultationById,
  getDistinctDoctorNames,
} from '@/src/features/consultations/consultationService';
import { getConsultationDoctor } from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

export function AddPlannedCareView() {
  const { consultationId, conditionId } = useLocalSearchParams<{
    consultationId?: string;
    conditionId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <AddPlannedCareForPatient
      key={`${activePatientId}:${consultationId || ''}:${conditionId || ''}`}
      activePatientId={activePatientId}
      consultationId={consultationId}
      conditionId={conditionId}
    />
  );
}

function AddPlannedCareForPatient({
  activePatientId,
  consultationId,
  conditionId,
}: {
  activePatientId: string;
  /** Created from a consultation, which becomes its origin. */
  consultationId?: string;
  /** Added from a condition, which starts out associated. */
  conditionId?: string;
}) {
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [specialists, setSpecialists] = useState<string[]>([]);
  // Added through a consultation, it defaults to that specialist.
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
  const router = useRouter();

  if (loadState === 'error')
    return <Text>Failed to load planned care form.</Text>;
  if (loadState === 'loading') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  const handleSubmit = async (values: PlannedCareFormValues) => {
    const created = await createOrUpdatePlannedCare({
      title: values.title,
      category: values.category,
      intent: values.intent,
      status: values.status,
      authoredDate: values.authoredDate
        ? formatLocalDate(values.authoredDate)
        : undefined,
      plannedDate: values.plannedDate
        ? formatLocalDate(values.plannedDate)
        : null,
      instructions: values.instructions,
      reason: values.reason,
      reasonConditionIds: values.reasonConditionIds,
      notes: values.notes,
      requesterName: values.requesterName,
      patientId: activePatientId,
      consultationId: consultationId || undefined,
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    if (consultationId) {
      router.dismissTo(`/consultation/${consultationId}`);
    } else if (conditionId) {
      router.dismissTo(`/condition/${conditionId}`);
    } else {
      goBackOr(router, `/planned-care/${created.id}`);
    }
  };

  return (
    <PlannedCareForm
      onSubmit={handleSubmit}
      conditions={conditions}
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
