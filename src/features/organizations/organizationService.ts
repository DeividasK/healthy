import * as Crypto from 'expo-crypto';
import type { Organization, Reference } from 'fhir/r5';
import {
  fetchOrganizationByName,
  fetchOrganizationNames,
  insertOrganizationRecord,
} from './organizationsRepository';

/**
 * Finds the patient's Organization with this name, or creates one, and
 * returns a reference to it. Call inside the transaction saving the
 * referencing resource so both writes commit together.
 */
export async function resolveOrganizationReference(
  name: string,
  patientId: string
): Promise<Reference> {
  const trimmed = name.trim();
  let organization = await fetchOrganizationByName(patientId, trimmed);
  if (!organization) {
    organization = {
      resourceType: 'Organization',
      id: `org-${Crypto.randomUUID()}`,
      meta: { lastUpdated: new Date().toISOString() },
      active: true,
      name: trimmed,
    } satisfies Organization;
    await insertOrganizationRecord(organization, patientId, true);
  }
  return {
    reference: `Organization/${organization.id}`,
    type: 'Organization',
    display: organization.name,
  };
}

/** Known service provider names for a patient, for autocomplete. */
export async function getOrganizationNames(
  patientId: string
): Promise<string[]> {
  return await fetchOrganizationNames(patientId);
}
