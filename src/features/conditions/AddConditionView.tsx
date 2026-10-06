import React from 'react';
import { ConditionForm } from './ConditionForm';
import { createOrUpdateCondition } from './conditionService';
import { useActivePatient } from '../profile/ActivePatientContext';

export function AddConditionView() {
  const { activePatientId } = useActivePatient();

  const handleSave = async (values: {
    id?: string;
    title: string;
    clinicalStatus: string;
    verificationStatus: string;
    onsetDate: string;
    severity?: string;
    bodySite?: string;
    abatementDate?: string;
    notes?: string;
  }) => {
    await createOrUpdateCondition({
      ...values,
      patientId: activePatientId,
    });
  };

  return <ConditionForm onSave={handleSave} />;
}
