/**
 * Record types replicated by sync, in dependency (apply) order: FHIR resource
 * types, plus `ProfileSettings` (app infrastructure, not a FHIR resource).
 */
export const SYNC_RESOURCE_TYPES = [
  'Patient',
  'ProfileSettings',
  'Organization',
  'Condition',
  'DiagnosticReport',
  'Encounter',
  'MedicationRequest',
  'MedicationStatement',
  'MedicationAdministration',
  'ServiceRequest',
  'RequestOrchestration',
  'Composition',
] as const;

export type SyncResourceType = (typeof SYNC_RESOURCE_TYPES)[number];

/**
 * One replicated change: the whole canonical FHIR resource (`put`) or a
 * tombstone (`delete`). Sync metadata never enters the resource JSON.
 */
export interface SyncChange {
  hlc: string;
  resourceType: SyncResourceType;
  id: string;
  patientId: string | null;
  op: 'put' | 'delete';
  resource?: Record<string, unknown>;
}

export function changeKey(change: Pick<SyncChange, 'resourceType' | 'id'>) {
  return `${change.resourceType}/${change.id}`;
}
