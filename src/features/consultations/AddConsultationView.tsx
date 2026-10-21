import type { ConsultationInput } from './consultationService';
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ConsultationForm } from './ConsultationForm';
import { createOrUpdateConsultation } from './consultationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { LoadingView } from '@/src/components/LoadingView';

export function AddConsultationView() {
  const { conditionId, basedOnId } = useLocalSearchParams<{
    conditionId?: string;
    /** Service request that led to this visit (`Encounter.basedOn`). */
    basedOnId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();

  if (isLoading) {
    return <LoadingView />;
  }

  const handleSave = async (values: ConsultationInput) => {
    await createOrUpdateConsultation({
      ...values,
      patientId: activePatientId,
      ...(basedOnId ? { basedOnServiceRequestIds: [basedOnId] } : {}),
    });
  };

  return (
    <ConsultationForm
      initialConditionIds={conditionId ? [conditionId] : []}
      onSave={handleSave}
    />
  );
}
