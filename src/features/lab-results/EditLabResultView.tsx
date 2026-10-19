import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import type { LinkFieldConfig } from '@/src/components/useLinkFields';
import { getServiceRequestLinkOptions } from '@/src/features/service-requests/serviceRequestService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getBasedOnServiceRequestIds } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { LabResultForm } from './LabResultForm';
import { getReportById } from './diagnosticReportService';

export function EditLabResultView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  const [linkFields, setLinkFields] = useState<LinkFieldConfig[] | null>(null);

  // Link fields start from their initial selection, so load them first.
  useEffect(() => {
    if (isLoading || !activePatientId) return;
    let isMounted = true;
    (async () => {
      try {
        const [record, serviceRequestOptions] = await Promise.all([
          id ? getReportById(id) : null,
          getServiceRequestLinkOptions(activePatientId),
        ]);
        if (!isMounted) return;
        setLinkFields([
          {
            type: 'service-request',
            label: 'Service requests',
            icon: ClipboardList,
            options: serviceRequestOptions,
            initialIds: record
              ? getBasedOnServiceRequestIds(record.report)
              : [],
          },
        ]);
      } catch (err) {
        console.error('Failed to load lab result links:', err);
        if (isMounted) setLinkFields([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [id, activePatientId, isLoading]);

  if (!linkFields) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }
  return (
    <LabResultForm
      key={activePatientId}
      initialReportId={id}
      isEdit
      linkFields={linkFields}
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
