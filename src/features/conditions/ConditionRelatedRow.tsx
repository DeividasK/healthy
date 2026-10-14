import React from 'react';
import { Calendar, CircleDot } from 'lucide-react-native';
import type { Condition } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { CONDITION_STATUS_OPTIONS } from './ConditionForm';

/** Meta line shared by condition rows and the condition view heading. */
export function getConditionMeta(condition: Condition): ResourceMeta[] {
  const statusCode = condition.clinicalStatus?.coding?.[0]?.code;
  const status =
    CONDITION_STATUS_OPTIONS.find((option) => option.id === statusCode)
      ?.label || statusCode;
  return [
    ...(condition.onsetDateTime
      ? [
          {
            icon: Calendar,
            text: formatDisplayDate(condition.onsetDateTime),
          },
        ]
      : []),
    ...(status ? [{ icon: CircleDot, text: status }] : []),
  ];
}

/** A condition listed on another resource's view page. */
export function ConditionRelatedRow({
  condition,
  testID,
  onPress,
  extraMeta = [],
}: {
  condition: Condition;
  testID?: string;
  onPress: () => void;
  /** Further meta items appended to the row, e.g. association counts. */
  extraMeta?: ResourceMeta[];
}) {
  const title = getConditionTitle(condition);
  return (
    <ResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View condition: ${title}`}
      meta={[...getConditionMeta(condition), ...extraMeta]}
      onPress={onPress}
    />
  );
}
