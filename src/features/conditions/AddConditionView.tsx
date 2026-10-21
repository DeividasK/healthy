import React from 'react';
import { ConditionForm } from './ConditionForm';
import {
  createOrUpdateCondition,
  type ConditionInput,
} from './conditionService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { LoadingView } from '@/src/components/LoadingView';

export function AddConditionView() {
  const { activePatientId, isLoading } = useActivePatient();

  if (isLoading) {
    return <LoadingView />;
  }

  const handleSave = async (values: ConditionInput) => {
    await createOrUpdateCondition({
      ...values,
      patientId: activePatientId,
    });
  };

  return <ConditionForm onSave={handleSave} />;
}
