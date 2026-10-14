import React from 'react';
import { Calendar, User } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import { RelatedResourceRow } from '@/src/components/RelatedResourceSection';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import { getTreatmentStatusLabel } from './treatmentLabels';

/** A treatment listed on another resource's view page. */
export function TreatmentRelatedRow({
  treatment,
  testID,
  onPress,
}: {
  treatment: MedicationRequest;
  testID?: string;
  onPress: () => void;
}) {
  const title = getTreatmentTitle(treatment);
  const date = treatment.authoredOn;
  const requester = treatment.requester?.display;
  return (
    <RelatedResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View treatment: ${title}`}
      meta={[
        ...(date
          ? [
              {
                icon: Calendar,
                text: date.includes('T')
                  ? formatDisplayDateTime(date)
                  : formatDisplayDate(date),
              },
            ]
          : []),
        ...(requester ? [{ icon: User, text: requester }] : []),
        { text: getTreatmentStatusLabel(treatment.status) },
      ]}
      onPress={onPress}
    />
  );
}
