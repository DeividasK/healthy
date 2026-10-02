import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { LabResultForm } from './LabResultForm';

export function EditLabResultView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LabResultForm initialReportId={id} isEdit />;
}
