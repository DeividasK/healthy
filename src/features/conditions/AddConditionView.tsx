import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { ConditionForm } from './ConditionForm';
import { createOrUpdateCondition } from './conditionService';
import { useActivePatient } from '../profile/ActivePatientContext';
import { COLORS } from '../../theme/colors';

export function AddConditionView() {
  const { activePatientId, isLoading } = useActivePatient();

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
