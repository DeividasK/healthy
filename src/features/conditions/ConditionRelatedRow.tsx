import React from 'react';
import {
  Activity,
  BadgeCheck,
  Calendar,
  CircleDot,
  MapPin,
  Tag,
} from 'lucide-react-native';
import type { Condition } from 'fhir/r5';
import {
  ResourceRow,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import {
  CONDITION_STATUS_OPTIONS,
  SEVERITY_OPTIONS,
  VERIFICATION_OPTIONS,
} from './ConditionForm';
import { getConditionCategoryLabel } from './conditionCategories';

/** Meta line shared by condition rows and the condition view heading. */
export function getConditionMeta(condition: Condition): ResourceMeta[] {
  const statusCode = condition.clinicalStatus?.coding?.[0]?.code;
  const status =
    CONDITION_STATUS_OPTIONS.find((option) => option.id === statusCode)
      ?.label || statusCode;
  const resolved = condition.abatementDateTime;
  const severityCode = condition.severity?.coding?.[0]?.code;
  const severity =
    SEVERITY_OPTIONS.find((option) => option.value === severityCode)?.label ||
    severityCode;
  const bodySite = condition.bodySite?.[0]?.text;
  const categories = (condition.category ?? [])
    .map(getConditionCategoryLabel)
    .filter(Boolean);
  const verification = condition.verificationStatus;
  const verificationLabel =
    verification &&
    (VERIFICATION_OPTIONS.find(
      (option) => option.id === verification.coding?.[0]?.code
    )?.label ||
      verification.text ||
      verification.coding?.[0]?.display ||
      verification.coding?.[0]?.code);
  return [
    ...(condition.onsetDateTime
      ? [
          {
            icon: Calendar,
            text: formatDisplayDate(condition.onsetDateTime),
          },
        ]
      : []),
    ...(status
      ? [
          {
            icon: CircleDot,
            text: resolved
              ? `${status} ${formatDisplayDate(resolved)}`
              : status,
          },
        ]
      : []),
    ...(severity
      ? [
          {
            icon: Activity,
            text: severity,
            accessibilityLabel: `Severity: ${severity}`,
          },
        ]
      : []),
    ...(bodySite ? [{ icon: MapPin, text: bodySite }] : []),
    ...categories.map((category, index) => ({
      icon: Tag,
      text: category,
      accessibilityLabel: `Category: ${category}`,
      testID: `condition-category-${index}`,
    })),
    ...(verificationLabel
      ? [
          {
            icon: BadgeCheck,
            text: verificationLabel,
            accessibilityLabel: `Verification status: ${verificationLabel}`,
            testID: 'condition-verification-status',
          },
        ]
      : []),
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
