import React from 'react';
import { ConditionForm } from './ConditionForm';
import { createOrUpdateCondition } from './conditionService';

export function AddConditionView() {
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
    await createOrUpdateCondition(values);
  };

  return <ConditionForm onSave={handleSave} />;
}
