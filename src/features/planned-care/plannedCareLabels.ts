import type { CodeableConcept, ServiceRequest } from 'fhir/r5';
import type { NativeSelectOption } from '@/src/components/NativeSelect.types';

type Intent = ServiceRequest['intent'];
type Status = ServiceRequest['status'];

export const SNOMED_SYSTEM = 'http://snomed.info/sct';

const INTENT_LABELS: Record<Intent, string> = {
  plan: 'Recommendation',
  order: 'Order',
  proposal: 'Proposal',
  directive: 'Directive',
  'original-order': 'Original order',
  'reflex-order': 'Reflex order',
  'filler-order': 'Filler order',
  'instance-order': 'Instance order',
  option: 'Option',
};

const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  completed: 'Completed',
  'on-hold': 'On Hold',
  revoked: 'Revoked',
  unknown: 'Unknown',
  draft: 'Draft',
  'entered-in-error': 'Entered in error',
};

/** Intents and statuses offered when creating; others remain editable. */
const OFFERED_INTENTS: Intent[] = ['plan', 'order'];
const OFFERED_STATUSES: Status[] = [
  'active',
  'completed',
  'on-hold',
  'revoked',
  'unknown',
];

/** Planned care categories (SNOMED CT, the example ServiceRequest binding). */
export const PLANNED_CARE_CATEGORIES = [
  { code: '108252007', display: 'Laboratory procedure', label: 'Lab test' },
  { code: '363679005', display: 'Imaging', label: 'Imaging' },
  { code: '71388002', display: 'Procedure', label: 'Procedure' },
  { code: '3457005', display: 'Patient referral', label: 'Referral' },
  { code: '390906007', display: 'Follow-up encounter', label: 'Follow-up' },
] as const;

export function getPlannedCareIntentLabel(intent: Intent | undefined): string {
  return (intent && INTENT_LABELS[intent]) || intent || 'Unknown';
}

export function getPlannedCareStatusLabel(status: Status | undefined): string {
  return (status && STATUS_LABELS[status]) || status || 'Unknown';
}

/** Offered intents, plus the current value when a record uses another code. */
export function getPlannedCareIntentOptions(
  current: Intent
): NativeSelectOption[] {
  const intents = OFFERED_INTENTS.includes(current)
    ? OFFERED_INTENTS
    : [...OFFERED_INTENTS, current];
  return intents.map((id) => ({ id, label: getPlannedCareIntentLabel(id) }));
}

/** Offered statuses, plus the current value when a record uses another code. */
export function getPlannedCareStatusOptions(
  current: Status
): NativeSelectOption[] {
  const statuses = OFFERED_STATUSES.includes(current)
    ? OFFERED_STATUSES
    : [...OFFERED_STATUSES, current];
  return statuses.map((id) => ({ id, label: getPlannedCareStatusLabel(id) }));
}

/** Label for a category: a known SNOMED code, else its source wording. */
export function getPlannedCareCategoryLabel(
  category: CodeableConcept | undefined
): string | null {
  if (!category) return null;
  const coding = category.coding?.find((c) => c.system === SNOMED_SYSTEM);
  const known = PLANNED_CARE_CATEGORIES.find((c) => c.code === coding?.code);
  return (
    known?.label ||
    category.text ||
    category.coding?.[0]?.display ||
    category.coding?.[0]?.code ||
    null
  );
}

/** Option id for a category: its SNOMED code, or `current` for other wording. */
export function getPlannedCareCategoryId(
  category: CodeableConcept | undefined
): string {
  if (!category) return '';
  const code = category.coding?.find((c) => c.system === SNOMED_SYSTEM)?.code;
  return PLANNED_CARE_CATEGORIES.some((c) => c.code === code)
    ? code!
    : 'current';
}

/** Category options; an unrecognised existing category stays selectable. */
export function getPlannedCareCategoryOptions(
  current: CodeableConcept | undefined
): NativeSelectOption[] {
  const options: NativeSelectOption[] = [
    { id: '', label: 'Not specified' },
    ...PLANNED_CARE_CATEGORIES.map((c) => ({ id: c.code, label: c.label })),
  ];
  if (getPlannedCareCategoryId(current) === 'current')
    options.push({
      id: 'current',
      label: getPlannedCareCategoryLabel(current) || 'Current category',
    });
  return options;
}
