import React from 'react';
import { useRouter } from 'expo-router';
import { Pill } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { ResourceSection } from '@/src/components/ResourceSection';
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
    <ResourceSection
      icon={Pill}
      title="Treatments"
      testID="consultation-treatments"
    >
      {linkedTreatments.map((treatment) => (
        <TreatmentRelatedRow
          key={treatment.id}
          treatment={treatment}
          testID={`consultation-treatment-${treatment.id}`}
          onPress={() => router.push(`/treatment/${treatment.id}`)}
        />
      ))}
    </ResourceSection>
  );
}
