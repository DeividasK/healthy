import React from 'react';
import { Activity, Calendar, CircleDot, User } from 'lucide-react-native';
import type { Encounter } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConsultationDoctor,
  getConsultationNotes,
  getConsultationServiceType,
  getConsultationTitle,
} from '@/src/utils/fhirUtils';

/** Display label of a consultation's FHIR Encounter status. */
export function getConsultationStatusLabel(consultation: Encounter) {
  return consultation.status
    ? consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1)
    : 'Unknown';
}

/** Meta line shared by consultation rows and the consultation view heading. */
export function getConsultationMeta(
  consultation: Encounter,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const id = (testID: string) => (withTestIDs ? testID : undefined);
  const date =
    consultation.actualPeriod?.start || consultation.plannedStartDate;
  const doctor = getConsultationDoctor(consultation);
  const serviceType = getConsultationServiceType(consultation);
  return [
    ...(date ? [{ icon: Calendar, text: formatDisplayDateTime(date) }] : []),
    { icon: CircleDot, text: getConsultationStatusLabel(consultation) },
    ...(doctor
      ? [{ icon: User, text: doctor, testID: id('consultation-doctor') }]
      : []),
    ...(serviceType
      ? [
          {
            icon: Activity,
            text: serviceType,
            testID: id('consultation-service-type'),
          },
        ]
      : []),
  ];
}

/** A consultation listed on another resource's view page. */
export function ConsultationRelatedRow({
  consultation,
  testID,
  onPress,
  showNotes = false,
  extraMeta = [],
}: {
  consultation: Encounter;
  testID?: string;
  onPress: () => void;
  /** Quote the consultation notes below the row. */
  showNotes?: boolean;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
}) {
  const title = getConsultationTitle(consultation);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View consultation: ${title}`}
      meta={[...getConsultationMeta(consultation), ...extraMeta]}
      note={showNotes ? getConsultationNotes(consultation) : null}
      onPress={onPress}
    />
  );
}
