import React from 'react';
import {
  Activity,
  BadgeCheck,
  Calendar,
  CalendarCheck,
  CircleDot,
  MapPin,
  Tag,
} from 'lucide-react-native';
import type { CodeableConcept, Condition } from 'fhir/r5';
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
import {
  CONDITION_SEVERITY_SYSTEM,
  VERIFICATION_STATUS_SYSTEM,
} from './conditionService';

/**
 * A coded concept's label: the app's own wording for a code from `system`,
 * otherwise the concept's text, the coding's display or its code.
 */
function getConceptLabel(
  concept: CodeableConcept | undefined,
  system: string,
  options: { id: string; label: string }[]
): string | undefined {
  const coding = concept?.coding?.[0];
  const own =
    coding?.system === system
      ? options.find((option) => option.id === coding.code)?.label
      : undefined;
  return own || concept?.text || coding?.display || coding?.code;
}

/** Meta line shared by condition rows and the condition view heading. */
export function getConditionMeta(condition: Condition): ResourceMeta[] {
  const statusCode = condition.clinicalStatus?.coding?.[0]?.code;
  const status =
    CONDITION_STATUS_OPTIONS.find((option) => option.id === statusCode)
      ?.label || statusCode;
  const resolved = condition.abatementDateTime;
  const severity = getConceptLabel(
    condition.severity,
    CONDITION_SEVERITY_SYSTEM,
    SEVERITY_OPTIONS.map(({ value, label }) => ({ id: value, label }))
  );
  const bodySite = condition.bodySite?.[0]?.text;
  const categories = (condition.category ?? [])
    .map(getConditionCategoryLabel)
    .filter(Boolean);
  const verificationLabel = getConceptLabel(
    condition.verificationStatus,
    VERIFICATION_STATUS_SYSTEM,
    VERIFICATION_OPTIONS
  );
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
    ...(resolved
      ? [
          {
            icon: CalendarCheck,
            text: `Resolved ${formatDisplayDate(resolved)}`,
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
      meta={[...getConditionMeta(condition), ...extraMeta]}
      onPress={onPress}
    />
  );
}
