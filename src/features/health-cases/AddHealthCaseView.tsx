import React from 'react';
import { HealthCaseForm } from './HealthCaseForm';
import { createOrUpdateHealthCase } from './healthCaseService';

export function AddHealthCaseView() {
  const handleSave = async (values: {
    title: string;
    status: any;
    startDate: string;
    description?: string;
  }) => {
    await createOrUpdateHealthCase(values);
  };

  return <HealthCaseForm onSave={handleSave} />;
}
