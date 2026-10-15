import type { ConsultationInput } from './consultationService';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConsultationForm } from './ConsultationForm';
import { createOrUpdateConsultation } from './consultationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';

export function AddConsultationView() {
  const { conditionId, basedOnId } = useLocalSearchParams<{
    conditionId?: string;
    /** Planned care that led to this visit (`Encounter.basedOn`). */
    basedOnId?: string;
  }>();
  const { activePatientId, isLoading } = useActivePatient();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
});
