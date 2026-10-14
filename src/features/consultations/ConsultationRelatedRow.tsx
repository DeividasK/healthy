import React from 'react';
import { Calendar, User } from 'lucide-react-native';
import type { Encounter } from 'fhir/r5';
import { RelatedResourceRow } from '@/src/components/RelatedResourceSection';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConsultationDoctor,
  getConsultationNotes,
  getConsultationServiceType,
  getConsultationTitle,
} from '@/src/utils/fhirUtils';

/** A consultation listed on another resource's view page. */
export function ConsultationRelatedRow({
  consultation,
  testID,
  onPress,
  showNotes = false,
}: {
  consultation: Encounter;
  testID?: string;
  onPress: () => void;
  /** Quote the consultation notes below the row. */
  showNotes?: boolean;
}) {
  const title = getConsultationTitle(consultation);
  const date =
    consultation.actualPeriod?.start || consultation.plannedStartDate;
  const doctor = getConsultationDoctor(consultation);
  const serviceType = getConsultationServiceType(consultation);
  return (
    <RelatedResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View consultation: ${title}`}
      meta={[
        ...(date
          ? [{ icon: Calendar, text: formatDisplayDateTime(date) }]
          : []),
        ...(doctor ? [{ icon: User, text: doctor }] : []),
        ...(serviceType ? [{ text: serviceType }] : []),
      ]}
      note={showNotes ? getConsultationNotes(consultation) : null}
      onPress={onPress}
    />
  );
}
