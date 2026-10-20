import React, { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { TreatmentForm, type TreatmentFormValues } from './TreatmentForm';
import { createOrUpdateTreatment } from './treatmentService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import {
  getConsultationById,
  getDistinctDoctorNames,
} from '@/src/features/consultations/consultationService';
import {
  getConsultationConditionIds,
  getConsultationDoctor,
  getConsultationReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import type { Condition } from 'fhir/r5';
import { LoadingView } from '@/src/components/LoadingView';

export function AddTreatmentView() {
  const { consultationId, conditionId } = useLocalSearchParams<{
    consultationId?: string;
    conditionId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading) return <LoadingView />;
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
  // Added through a consultation, the treatment defaults to that visit's
  // date, specialist and conditions (its diagnoses and reasons for visit).
  const [consultationSpecialist, setConsultationSpecialist] = useState('');
  const [consultationConditionIds, setConsultationConditionIds] = useState<
    string[]
  >([]);
  const [consultationDate, setConsultationDate] = useState<Date>();
  // Only a consultation that loaded for the active patient is the origin.
  const [originId, setOriginId] = useState<string>();
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
        const date =
          consultation?.actualPeriod?.start || consultation?.plannedStartDate;
        setConsultationDate(date ? parseLocalDate(date) : undefined);
        const patientConditionIds = new Set(
          patientConditions.map((condition) => condition.id)
        );
        setConsultationConditionIds(
          consultation
            ? [
                ...getConsultationConditionIds(consultation),
                ...getConsultationReasonConditionIds(consultation),
              ].filter((id) => patientConditionIds.has(id))
            : []
        );
        setOriginId(consultation?.id);
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

  if (loadState === 'error') return <Text>Failed to load treatment form.</Text>;
  if (loadState === 'loading') {
    return <LoadingView />;
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
      regimen: values.regimen,
      dispenseQuantity: values.dispenseQuantity,
      reason: values.reason,
      reasonConditionIds: values.reasonConditionIds,
      notes: values.notes,
      patientId: activePatientId,
      consultationId: originId,
      requesterName: values.requesterName,
      usageStart: values.usageStart
        ? formatLocalDate(values.usageStart)
        : undefined,
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }

    // Open the new treatment; going back returns to where it was added.
    router.replace(`/treatment/${created.id}`);
  };

  return (
    <TreatmentForm
      onSubmit={handleSubmit}
      conditions={conditions}
      isEditing={false}
      initialValues={{
        requesterName: consultationSpecialist,
        authoredDate: consultationDate,
        reasonConditionIds: [
          ...new Set([
            ...(conditionId ? [conditionId] : []),
            ...consultationConditionIds,
          ]),
        ],
      }}
      specialistSuggestions={specialists}
    />
  );
}
