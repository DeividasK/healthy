import React from 'react';
import { Calendar, CircleDot, Target, User } from 'lucide-react-native';
import type { MedicationRequest } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
  type ResourceRowAppearance,
} from '@/src/components/ResourceSection';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';
import {
  getTreatmentIntentLabel,
  getTreatmentStatusLabel,
} from './treatmentLabels';

/** Meta line shared by treatment rows and the treatment view heading. */
export function getTreatmentMeta(
  treatment: MedicationRequest,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const id = (testID: string) => (withTestIDs ? testID : undefined);
  const date = treatment.authoredOn;
  const requester = treatment.requester?.display;
  return [
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
    { icon: CircleDot, text: getTreatmentStatusLabel(treatment.status) },
    ...(requester
      ? [{ icon: User, text: requester, testID: id('treatment-requester') }]
      : []),
    {
      icon: Target,
      text: getTreatmentIntentLabel(treatment.intent),
      testID: id('treatment-intent'),
    },
  ];
}

/** A treatment listed on another resource's view page. */
export function TreatmentRelatedRow({
  treatment,
  testID,
  onPress,
  extraMeta = [],
  appearance,
}: {
  treatment: MedicationRequest;
  testID?: string;
  onPress: () => void;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
  /** Timeline node, status wash or fading. */
  appearance?: ResourceRowAppearance;
}) {
  const title = getTreatmentTitle(treatment);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      meta={[...getTreatmentMeta(treatment), ...extraMeta]}
      onPress={onPress}
      {...appearance}
    />
  );
}
