import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ConditionForm } from './ConditionForm';
import { createOrUpdateCondition } from './conditionService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';

export function AddConditionView() {
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
    triggerSync().catch((err) =>
      console.warn('Background sync failed on add condition:', err)
    );
  };

  return <ConditionForm onSave={handleSave} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
});
