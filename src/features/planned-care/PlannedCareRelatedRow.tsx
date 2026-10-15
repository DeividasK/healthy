import React from 'react';
import {
  Calendar,
  CalendarClock,
  CircleDot,
  Tag,
  Target,
  User,
} from 'lucide-react-native';
import type { ServiceRequest } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import { getPlannedCareTitle } from '@/src/utils/fhirUtils';
import {
  getPlannedCareCategoryLabel,
  getPlannedCareIntentLabel,
  getPlannedCareStatusLabel,
} from './plannedCareLabels';

const formatDate = (date: string) =>
  date.includes('T') ? formatDisplayDateTime(date) : formatDisplayDate(date);

/** Meta line shared by planned care rows and the planned care view heading. */
export function getPlannedCareMeta(
  request: ServiceRequest,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const id = (testID: string) => (withTestIDs ? testID : undefined);
  const requester = request.requester?.display;
  const category = getPlannedCareCategoryLabel(request.category?.[0]);
  const planned = request.occurrenceDateTime;
  return [
    ...(request.authoredOn
      ? [{ icon: Calendar, text: formatDate(request.authoredOn) }]
      : []),
    { icon: CircleDot, text: getPlannedCareStatusLabel(request.status) },
    ...(requester
      ? [{ icon: User, text: requester, testID: id('planned-care-requester') }]
      : []),
    ...(category
      ? [{ icon: Tag, text: category, testID: id('planned-care-category') }]
      : []),
    {
      icon: Target,
      text: getPlannedCareIntentLabel(request.intent),
      testID: id('planned-care-intent'),
    },
    ...(planned
      ? [
          {
            icon: CalendarClock,
            text: `Planned ${formatDate(planned)}`,
            testID: id('planned-care-planned-date'),
          },
        ]
      : []),
  ];
}

/** Planned care listed on another resource's view page. */
export function PlannedCareRelatedRow({
  request,
  testID,
  onPress,
  extraMeta = [],
}: {
  request: ServiceRequest;
  testID?: string;
  onPress: () => void;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
}) {
  const title = getPlannedCareTitle(request);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View service request: ${title}`}
      meta={[...getPlannedCareMeta(request), ...extraMeta]}
      onPress={onPress}
    />
  );
}
