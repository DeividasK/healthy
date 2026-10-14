import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TreatmentForm, type TreatmentFormValues } from './TreatmentForm';
import {
  getTreatmentById,
  createOrUpdateTreatment,
  deleteTreatment,
} from './treatmentService';
import {
  getTreatmentTitle,
  getTreatmentInstructions,
  getTreatmentNotes,
  getTreatmentReason,
  getTreatmentReasonConditionId,
} from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import type { Condition } from 'fhir/r5';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';

export function EditTreatmentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ActivityIndicator accessibilityLabel="Loading patient" />;
  return (
    <EditTreatmentForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function EditTreatmentForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const { triggerSync } = useSync();
  const router = useRouter();

  const [initialValues, setInitialValues] =
    useState<TreatmentFormValues | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id || !activePatientId) return;

    let isMounted = true;
    (async () => {
      try {
        const [treatment, patientConditions] = await Promise.all([
          getTreatmentById(id, activePatientId),
          getAllConditions(activePatientId),
        ]);
        if (!isMounted) return;
        setConditions(patientConditions);
        if (!treatment) {
          setNotFound(true);
          return;
        }

        setNotFound(false);
        const dateStr = treatment.authoredOn;
        let dateObj = new Date();
        if (dateStr && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        setInitialValues({
          id: treatment.id,
          title: getTreatmentTitle(treatment),
          intent: treatment.intent,
          status: treatment.status,
          authoredDate: dateObj,
          originalAuthoredOn: treatment.authoredOn,
          dosageInstructions: getTreatmentInstructions(treatment) || '',
          reason: getTreatmentReason(treatment) || '',
          reasonConditionId: getTreatmentReasonConditionId(treatment),
          notes: getTreatmentNotes(treatment) || '',
        });
      } catch (err) {
        console.error('Failed to load treatment for editing:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id, activePatientId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !initialValues) {
    return (
      <View style={styles.notFoundContainer} testID="edit-treatment-not-found">
        <Text style={styles.notFoundText}>Treatment not found</Text>
      </View>
    );
  }

  const handleSubmit = async (values: TreatmentFormValues) => {
    const formattedDate = values.authoredDate
      ? formatLocalDate(values.authoredDate)
      : undefined;
    await createOrUpdateTreatment({
      id: values.id,
      title: values.title,
      intent: values.intent,
      status: values.status,
      authoredDate: formattedDate,
      dosageInstructions: values.dosageInstructions,
      reason: values.reason,
      reasonConditionId: values.reasonConditionId,
      notes: values.notes,
      patientId: activePatientId,
    });

    triggerSync().catch((err) =>
      console.warn('Background sync failed on edit treatment:', err)
    );

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(`/treatment/${id}`);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    await deleteTreatment(id, activePatientId);
    triggerSync().catch((err) =>
      console.warn('Background sync failed on delete treatment:', err)
    );
    router.dismissTo('/');
  };

  return (
    <TreatmentForm
      initialValues={initialValues}
      conditions={conditions}
      onSubmit={handleSubmit}
      onDelete={handleDelete}
      isEditing
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
  notFoundContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.light.mutedForeground,
  },
});
