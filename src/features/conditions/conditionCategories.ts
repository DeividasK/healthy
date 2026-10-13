import type { CodeableConcept } from 'fhir/r5';

export const CONDITION_CATEGORY_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/condition-category';
export const CATEGORY_OPTIONS = [
  {
    id: 'problem-list-item',
    label: 'Ongoing',
    system: CONDITION_CATEGORY_SYSTEM,
    legacyLabel: 'Problem list item',
  },
  {
    id: 'encounter-diagnosis',
    label: 'Temporary',
    system: CONDITION_CATEGORY_SYSTEM,
    legacyLabel: 'Encounter diagnosis',
  },
];

export function encodeConditionCategory(value: string): CodeableConcept {
  const text = value.trim();
  const option = CATEGORY_OPTIONS.find((item) =>
    [item.id, item.label, item.legacyLabel].includes(text)
  );
  return option
    ? { coding: [{ system: option.system, code: option.id }] }
    : { text };
}

export function getConditionCategoryLabel(category?: CodeableConcept): string {
  const coding = category?.coding?.[0];
  const option = CATEGORY_OPTIONS.find(
    (item) => item.id === coding?.code && item.system === coding?.system
  );
  return (
    option?.label || category?.text || coding?.display || coding?.code || ''
  );
}
