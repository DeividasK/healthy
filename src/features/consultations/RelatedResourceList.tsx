import React from 'react';
import { useRouter } from 'expo-router';
import { Pill } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { RelatedResourceSection } from '@/src/components/RelatedResourceSection';
import { TreatmentRelatedRow } from '@/src/features/treatments/TreatmentRelatedRow';

export interface RelatedResourceListProps {
  linkedTreatments: MedicationRequest[];
}

/** Treatments listed in the consultation's document. */
export function RelatedResourceList({
  linkedTreatments,
}: RelatedResourceListProps) {
  const router = useRouter();
  return (
    <RelatedResourceSection
      icon={Pill}
      title="Treatments"
      testID="consultation-treatments"
      emptyText="No treatments linked to this consultation."
      emptyTestID="consultation-no-treatments"
    >
      {linkedTreatments.map((treatment) => (
        <TreatmentRelatedRow
          key={treatment.id}
          treatment={treatment}
          testID={`consultation-treatment-${treatment.id}`}
          onPress={() => router.dismissTo(`/treatment/${treatment.id}`)}
        />
      ))}
    </RelatedResourceSection>
  );
}
