import React from 'react';
import {
  Calendar,
  CalendarClock,
  CircleDot,
  Clock,
  Repeat2,
  Tag,
  Target,
  Timer,
  User,
} from 'lucide-react-native';
import type { ServiceRequest } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
  type ResourceRowAppearance,
} from '@/src/components/ResourceSection';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import { getServiceRequestTitle } from '@/src/utils/fhirUtils';
import {
  getServiceRequestCategoryLabel,
  getServiceRequestIntentLabel,
  getServiceRequestStatusLabel,
} from './serviceRequestLabels';
import {
  formatScheduleDuration,
  formatScheduleRepeat,
  formatScheduleTime,
  getScheduleRepeat,
} from './serviceRequestSchedule';

const formatDate = (date: string) =>
  date.includes('T') ? formatDisplayDateTime(date) : formatDisplayDate(date);

/** Meta line shared by service request rows and the service request view heading. */
export function getServiceRequestMeta(
  request: ServiceRequest,
  { withTestIDs = false } = {}
): ResourceMeta[] {
  const id = (testID: string) => (withTestIDs ? testID : undefined);
  const requester = request.requester?.display;
  const category = getServiceRequestCategoryLabel(request.category?.[0]);
  const planned = request.occurrenceDateTime;
  const repeat = getScheduleRepeat(request);
  const schedule = repeat && formatScheduleRepeat(repeat);
  const time = repeat && formatScheduleTime(repeat);
  const duration = repeat && formatScheduleDuration(repeat);
  return [
    ...(request.authoredOn
      ? [{ icon: Calendar, text: formatDate(request.authoredOn) }]
      : []),
    { icon: CircleDot, text: getServiceRequestStatusLabel(request.status) },
    ...(requester
      ? [
          {
            icon: User,
            text: requester,
            testID: id('service-request-requester'),
          },
        ]
      : []),
    ...(category
      ? [{ icon: Tag, text: category, testID: id('service-request-category') }]
      : []),
    {
      icon: Target,
      text: getServiceRequestIntentLabel(request.intent),
      testID: id('service-request-intent'),
    },
    ...(planned
      ? [
          {
            icon: CalendarClock,
            text: `Planned ${formatDate(planned)}`,
            testID: id('service-request-planned-date'),
          },
        ]
      : []),
    ...(schedule
      ? [
          {
            icon: Repeat2,
            text: schedule,
            testID: id('service-request-schedule'),
          },
        ]
      : []),
    ...(time
      ? [
          {
            icon: Clock,
            text: time,
            testID: id('service-request-time-of-day'),
          },
        ]
      : []),
    ...(duration
      ? [
          {
            icon: Timer,
            text: duration,
            testID: id('service-request-duration'),
          },
        ]
      : []),
  ];
}

/** Service request listed on another resource's view page. */
export function ServiceRequestRelatedRow({
  request,
  testID,
  onPress,
  extraMeta = [],
  appearance,
}: {
  request: ServiceRequest;
  testID?: string;
  onPress: () => void;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
  /** Timeline node, status wash or fading. */
  appearance?: ResourceRowAppearance;
}) {
  const title = getServiceRequestTitle(request);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View service request: ${title}`}
      meta={[...getServiceRequestMeta(request), ...extraMeta]}
      onPress={onPress}
      {...appearance}
    />
  );
}
