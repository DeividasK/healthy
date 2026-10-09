import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConsultationForm } from './ConsultationForm';
import { createOrUpdateConsultation } from './consultationService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';

export function AddConsultationView() {
  const { conditionId } = useLocalSearchParams<{ conditionId?: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const { triggerSync } = useSync();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  const handleSave = async (values: {
    id?: string;
    title: string;
    status: string;
    date: string;
    doctorName?: string;
    serviceType?: string;
    conditionId?: string | null;
    notes?: string;
  }) => {
    await createOrUpdateConsultation({
      ...values,
      patientId: activePatientId,
    });
    triggerSync().catch((err) =>
      console.warn('Background sync failed on add consultation:', err)
    );
  };

  return (
    <ConsultationForm
      initialConditionId={conditionId || null}
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
