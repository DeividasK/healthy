import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AutocompleteItem } from '@/src/components/AutocompleteDropdown';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getTreatmentLinkOptions } from '@/src/features/treatments/treatmentService';
import { COLORS } from '@/src/theme/colors';
import { BundleForm } from './BundleForm';
import {
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
  type BundleValues,
} from './bundleModel';
import { getBundleById, saveBundle } from './bundleService';

export function EditBundleView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePatientId, isLoading } = useActivePatient();
  const [loaded, setLoaded] = useState<{
    values: BundleValues | null;
    treatmentOptions: AutocompleteItem[];
  } | null>(null);

  useEffect(() => {
    if (!activePatientId || !id) return;
    let isMounted = true;
    void Promise.all([
      getBundleById(id, activePatientId),
      getTreatmentLinkOptions(activePatientId),
    ]).then(([bundle, treatmentOptions]) => {
      if (!isMounted) return;
      setLoaded({
        treatmentOptions,
        values: bundle && {
          title: getBundleTitle(bundle),
          times: getBundleTimes(bundle),
          memberIds: getBundleMemberIds(bundle),
        },
      });
    });
    return () => {
      isMounted = false;
    };
  }, [id, activePatientId]);

  if (isLoading || !loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }
  if (!loaded.values) {
    return (
      <View style={styles.center} testID="edit-bundle-not-found">
        <Text style={styles.notFoundText}>Bundle not found</Text>
      </View>
    );
  }

  return (
    <BundleForm
      key={`${activePatientId}:${id}`}
      isEditing
      initialValues={loaded.values}
      treatmentOptions={loaded.treatmentOptions}
      onSubmit={async (values) => {
        await saveBundle({ ...values, id, patientId: activePatientId });
        router.dismissTo(`/bundle/${id}`);
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
    padding: 20,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.light.mutedForeground,
  },
});
