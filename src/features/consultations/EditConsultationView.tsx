import type { ConsultationInput } from './consultationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSync } from '@/src/context/SyncContext';
import { ConsultationForm, ConsultationFormValues } from './ConsultationForm';
import {
  getConsultationById,
  createOrUpdateConsultation,
  deleteConsultation,
} from './consultationService';
import {
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { getConditionById } from '@/src/features/conditions/conditionService';
import { parseLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { Pill } from 'lucide-react-native';
import {
  diffLinkIds,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import {
  getLinkedTreatmentsForConsultation,
  getTreatmentLinkOptions,
  linkTreatmentToConsultation,
  unlinkTreatmentFromConsultation,
} from '@/src/features/treatments/treatmentService';

export function EditConsultationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { triggerSync } = useSync();
  const [initialValues, setInitialValues] =
    useState<ConsultationFormValues | null>(null);
  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );
  const [linkFields, setLinkFields] = useState<LinkFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id || !activePatientId || isPatientLoading) return;

    let isMounted = true;
    (async () => {
      try {
        const [encounter, treatmentOptions, linkedTreatments] =
          await Promise.all([
            getConsultationById(id, activePatientId),
            getTreatmentLinkOptions(activePatientId),
            getLinkedTreatmentsForConsultation(id, activePatientId),
          ]);
        if (!isMounted) return;
        setLinkFields([
          {
            type: 'treatment',
            label: 'Treatments',
            icon: Pill,
            options: treatmentOptions,
            initialIds: linkedTreatments.map((item) => item.id!),
          },
        ]);
        if (!encounter) {
          setNotFound(true);
          return;
        }

        const patientRef = encounter.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);
        setNotFound(false);

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
        const conditionIds = getConsultationConditionIds(encounter);
        const diagnoses = await Promise.all(
          (encounter.diagnosis || []).map(async (original) => {
            const value = original.condition?.[0];
            const reference = value?.reference?.reference;
            const conditionId = reference?.startsWith('Condition/')
              ? reference.slice(10)
              : undefined;
            const condition = conditionId
              ? await getConditionById(conditionId, activePatientId)
              : null;
            const title =
              value?.concept?.text ||
              condition?.code?.text ||
              value?.concept?.coding?.[0]?.display ||
              value?.reference?.display ||
              'Diagnosis';
            const terminology = value?.concept?.coding?.[0] || {};
            return {
              title,
              terminology,
              conditionId,
              original,
              originalTitle: title,
              originalTerminology: terminology,
              originalConditionId: conditionId,
            };
          })
        );
        if (!isMounted) return;
        const status = encounter.status || 'completed';

        setInitialValues({
          id: encounter.id,
          title,
          status,
          date: dateObj,
          time: timeStr,
          doctorName,
          serviceType,
          conditionIds,
          reasonConditionIds: getConsultationReasonConditionIds(encounter),
          diagnoses,
          notes,
        });
      } catch (err) {
        console.error('Failed to load consultation for edit:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id, activePatientId, isPatientLoading]);

  if (isLoading || isPatientLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !initialValues || initialPatientId !== activePatientId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Consultation not found.</Text>
      </View>
    );
  }

  const handleSave = async (
    values: ConsultationInput,
    links: Record<string, LinkSelection>
  ) => {
    await createOrUpdateConsultation({
      ...values,
      id,
      patientId: initialPatientId,
    });
    const changes = diffLinkIds(linkFields[0].initialIds, links.treatment.ids);
    for (const treatmentId of changes.added)
      await linkTreatmentToConsultation(treatmentId, id, initialPatientId);
    for (const treatmentId of changes.removed)
      await unlinkTreatmentFromConsultation(treatmentId, id, initialPatientId);
  };

  return (
    <ConsultationForm
      isEdit
      initialValues={initialValues}
      linkFields={linkFields}
      onSave={handleSave}
      onDelete={async () => {
        if (!id) return;
        await deleteConsultation(id);
        triggerSync().catch((error) =>
          console.warn('Background sync failed on delete consultation:', error)
        );
        router.dismissTo(
          initialValues.conditionIds?.[0]
            ? `/condition/${initialValues.conditionIds?.[0]}`
            : '/'
        );
      }}
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
