import React from 'react';
import { HealthCaseForm } from '../../src/components/HealthCaseForm';
import { createOrUpdateHealthCase } from '../../src/services/healthCaseService';

export default function AddHealthCaseScreen() {
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
