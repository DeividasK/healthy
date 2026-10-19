import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AutocompleteItem } from '@/src/components/AutocompleteDropdown';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getTreatmentLinkOptions } from '@/src/features/treatments/treatmentService';
import { COLORS } from '@/src/theme/colors';
import { BundleForm } from './BundleForm';
import { saveBundle } from './bundleService';

/** Creates a bundle, optionally starting with a treatment (`treatmentId`). */
export function AddBundleView() {
  const router = useRouter();
  const { treatmentId } = useLocalSearchParams<{ treatmentId?: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [treatmentOptions, setTreatmentOptions] = useState<
    AutocompleteItem[] | null
  >(null);

  useEffect(() => {
    if (!activePatientId) return;
    let isMounted = true;
    void getTreatmentLinkOptions(activePatientId).then((options) => {
      if (isMounted) setTreatmentOptions(options);
    });
    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  if (isLoading || !treatmentOptions) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  return (
    <BundleForm
      key={activePatientId}
      treatmentOptions={treatmentOptions}
      initialValues={{
        memberIds:
          treatmentId &&
          treatmentOptions.some((option) => option.id === treatmentId)
            ? [treatmentId]
            : [],
      }}
      onSubmit={async (values) => {
        const id = await saveBundle({ ...values, patientId: activePatientId });
        router.replace(`/bundle/${id}`);
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
});
