import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { AutocompleteItem } from '@/src/components/AutocompleteDropdown';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getTreatmentLinkOptions } from '@/src/features/treatments/treatmentService';
import { getActivityLinkOptions } from '@/src/features/service-requests/serviceRequestService';
import { BundleForm } from './BundleForm';
import { saveBundle } from './bundleService';
import { LoadingView } from '@/src/components/LoadingView';

/** Creates a bundle, optionally starting with a treatment (`treatmentId`). */
export function AddBundleView() {
  const router = useRouter();
  const { treatmentId } = useLocalSearchParams<{ treatmentId?: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [options, setOptions] = useState<{
    treatments: AutocompleteItem[];
    activities: AutocompleteItem[];
  } | null>(null);

  useEffect(() => {
    if (!activePatientId) return;
    let isMounted = true;
    void Promise.all([
      getTreatmentLinkOptions(activePatientId),
      getActivityLinkOptions(activePatientId),
    ]).then(([treatments, activities]) => {
      if (isMounted) setOptions({ treatments, activities });
    });
    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  if (isLoading || !options) {
    return <LoadingView />;
  }

  return (
    <BundleForm
      key={activePatientId}
      treatmentOptions={options.treatments}
      activityOptions={options.activities}
      initialValues={{
        memberIds:
          treatmentId &&
          options.treatments.some((option) => option.id === treatmentId)
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
