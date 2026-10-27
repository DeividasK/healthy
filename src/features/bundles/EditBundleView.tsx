import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AutocompleteItem } from '@/src/components/AutocompleteDropdown';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getTreatmentLinkOptions } from '@/src/features/treatments/treatmentService';
import { getActivityLinkOptions } from '@/src/features/service-requests/serviceRequestService';
import { COLORS } from '@/src/theme/colors';
import { BundleForm } from './BundleForm';
import {
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
  type BundleValues,
} from './bundleModel';
import {
  getBundleById,
  getTreatmentsAtBundleLimit,
  saveBundle,
} from './bundleService';
import { LoadingView } from '@/src/components/LoadingView';

export function EditBundleView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePatientId, isLoading } = useActivePatient();
  const [loaded, setLoaded] = useState<{
    values: BundleValues | null;
    treatmentOptions: AutocompleteItem[];
    activityOptions: AutocompleteItem[];
  } | null>(null);

  useEffect(() => {
    if (!activePatientId || !id) return;
    let isMounted = true;
    void Promise.all([
      getBundleById(id, activePatientId),
      getTreatmentLinkOptions(activePatientId),
      getActivityLinkOptions(activePatientId),
      getTreatmentsAtBundleLimit(activePatientId, id),
    ]).then(([bundle, treatmentOptions, activityOptions, full]) => {
      if (!isMounted) return;
      const memberIds = bundle ? getBundleMemberIds(bundle) : [];
      setLoaded({
        // Treatments already in as many bundles as they have doses can't
        // join; this bundle's own members stay.
        treatmentOptions: treatmentOptions.filter(
          (option) =>
            memberIds.includes(option.id) ||
            !full.some((treatment) => treatment.id === option.id)
        ),
        activityOptions,
        values: bundle && {
          title: getBundleTitle(bundle),
          times: getBundleTimes(bundle),
          memberIds,
          activityIds: getBundleActivityIds(bundle),
        },
      });
    });
    return () => {
      isMounted = false;
    };
  }, [id, activePatientId]);

  if (isLoading || !loaded) {
    return <LoadingView />;
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
      activityOptions={loaded.activityOptions}
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
