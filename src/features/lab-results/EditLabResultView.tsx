import React, { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import type { LinkFieldConfig } from '@/src/components/useLinkFields';
import { getServiceRequestLinkOptions } from '@/src/features/service-requests/serviceRequestService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getBasedOnServiceRequestIds } from '@/src/utils/fhirUtils';
import { LabResultForm } from './LabResultForm';
import { getReportById } from './diagnosticReportService';
import { LoadingView } from '@/src/components/LoadingView';

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
    return <LoadingView />;
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
