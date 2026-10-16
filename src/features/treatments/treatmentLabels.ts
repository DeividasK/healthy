import type { MedicationRequest } from 'fhir/r5';
import type { NativeSelectOption } from '@/src/components/NativeSelect.types';

type Intent = MedicationRequest['intent'];
type Status = MedicationRequest['status'];

const INTENT_LABELS: Record<Intent, { full: string; short: string }> = {
  plan: { full: 'Recommendation', short: 'Plan' },
  order: { full: 'Prescription', short: 'Prescription' },
  proposal: { full: 'Proposal', short: 'Proposal' },
  'original-order': { full: 'Original order', short: 'Original order' },
  'reflex-order': { full: 'Reflex order', short: 'Reflex order' },
  'filler-order': { full: 'Filler order', short: 'Filler order' },
  'instance-order': { full: 'Instance order', short: 'Instance order' },
  option: { full: 'Option', short: 'Option' },
};

const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  completed: 'Completed',
  'on-hold': 'On Hold',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
  ended: 'Ended',
  stopped: 'Stopped',
  'entered-in-error': 'Entered in error',
  draft: 'Draft',
};

/** Intents offered when creating a treatment; others remain editable. */
const OFFERED_INTENTS: Intent[] = ['plan', 'order'];
/**
 * Statuses a user can choose. `unknown` is reserved for imported records whose
 * status was not stated; such a record still shows it as its current value.
 */
const OFFERED_STATUSES: Status[] = [
  'active',
  'on-hold',
  'completed',
  'stopped',
  'cancelled',
];

/** Display label for a MedicationRequest intent code. */
export function getTreatmentIntentLabel(
  intent: Intent | undefined,
  variant: 'full' | 'short' = 'full'
): string {
  return (intent && INTENT_LABELS[intent]?.[variant]) || intent || 'Unknown';
}

/** Display label for a MedicationRequest status code. */
export function getTreatmentStatusLabel(status: Status | undefined): string {
  return (status && STATUS_LABELS[status]) || status || 'Unknown';
}

/** Offered intents, plus the current value when a record uses another code. */
export function getTreatmentIntentOptions(
  current: Intent
): NativeSelectOption[] {
  const intents = OFFERED_INTENTS.includes(current)
    ? OFFERED_INTENTS
    : [...OFFERED_INTENTS, current];
  return intents.map((id) => ({ id, label: getTreatmentIntentLabel(id) }));
}

/** Offered statuses, plus the current value when a record uses another code. */
export function getTreatmentStatusOptions(
  current: Status
): NativeSelectOption[] {
  const statuses = OFFERED_STATUSES.includes(current)
    ? OFFERED_STATUSES
    : [...OFFERED_STATUSES, current];
  return statuses.map((id) => ({ id, label: getTreatmentStatusLabel(id) }));
}
