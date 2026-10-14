import React from 'react';
import { Calendar } from 'lucide-react-native';
import type { Condition } from 'fhir/r5';
import { RelatedResourceRow } from '@/src/components/RelatedResourceSection';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { CONDITION_STATUS_OPTIONS } from './ConditionForm';

/** A condition listed on another resource's view page. */
export function ConditionRelatedRow({
  condition,
  testID,
  onPress,
}: {
  condition: Condition;
  testID?: string;
  onPress: () => void;
}) {
  const title = getConditionTitle(condition);
  const statusCode = condition.clinicalStatus?.coding?.[0]?.code;
  const status =
    CONDITION_STATUS_OPTIONS.find((option) => option.id === statusCode)
      ?.label || statusCode;
  return (
    <RelatedResourceRow
      testID={testID}
      title={title}
      accessibilityLabel={`View condition: ${title}`}
      meta={[
        ...(condition.onsetDateTime
          ? [
              {
                icon: Calendar,
                text: formatDisplayDate(condition.onsetDateTime),
              },
            ]
          : []),
        ...(status ? [{ text: status }] : []),
      ]}
      onPress={onPress}
    />
  );
}
