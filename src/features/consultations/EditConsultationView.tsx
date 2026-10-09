import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConsultationForm, ConsultationFormValues } from './ConsultationForm';
import {
  getConsultationById,
  createOrUpdateConsultation,
} from './consultationService';
import {
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionId,
} from '@/src/utils/fhirUtils';
import { parseLocalDate } from '@/src/utils/dateUtils';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';

export function EditConsultationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { triggerSync } = useSync();
  const [initialValues, setInitialValues] =
    useState<ConsultationFormValues | null>(null);
  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    (async () => {
      try {
        const encounter = await getConsultationById(id);
        if (!isMounted) return;
        if (!encounter) {
          setNotFound(true);
          return;
        }

        const patientRef = encounter.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);

        const dateStr =
          encounter.actualPeriod?.start ||
          encounter.plannedStartDate ||
          new Date().toISOString().split('T')[0];
        let timeStr: string | null = null;
        if (dateStr.includes('T')) {
          const timeParts = (dateStr.split('T')[1] || '').split(':');
          if (timeParts.length >= 2) {
            timeStr = `${timeParts[0]}:${timeParts[1]}`;
          }
        }
        const dateObj = parseLocalDate(dateStr);

        const title = getConsultationTitle(encounter);
        const doctorName = getConsultationDoctor(encounter) || undefined;
        const serviceType = getConsultationServiceType(encounter) || undefined;
        const notes = getConsultationNotes(encounter) || undefined;
        const conditionId = getConsultationConditionId(encounter);
        const status = encounter.status || 'completed';

        setInitialValues({
          id: encounter.id,
          title,
          status,
          date: dateObj,
          time: timeStr,
          doctorName,
          serviceType,
          conditionId,
          notes,
        });
      } catch (err) {
        console.error('Failed to load consultation for edit:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !initialValues) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Consultation not found.</Text>
      </View>
    );
  }

  const handleSave = async (values: {
    id?: string;
    title: string;
    status: string;
    date: string;
    doctorName?: string;
    serviceType?: string;
    conditionId?: string | null;
    notes?: string;
  }) => {
    await createOrUpdateConsultation({
      ...values,
      id,
      patientId: initialPatientId,
    });
    triggerSync().catch((err) =>
      console.warn('Background sync failed on edit consultation:', err)
    );
  };

  return (
    <ConsultationForm
      isEdit
      initialValues={initialValues}
      onSave={handleSave}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
});
