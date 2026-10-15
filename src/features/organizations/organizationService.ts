import * as Crypto from 'expo-crypto';
import type { Organization, Reference } from 'fhir/r5';
import {
  fetchOrganizationById,
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

/**
 * The name shown for a service provider reference: its `display`, or the
 * stored Organization's name when a reference (e.g. imported) has none.
 */
export async function getServiceProviderName(
  reference: Reference | undefined,
  patientId: string
): Promise<string | null> {
  if (reference?.display) return reference.display;
  const target = reference?.reference;
  if (!target?.startsWith('Organization/')) return null;
  const organization = await fetchOrganizationById(target.slice(13), patientId);
  return organization?.name?.trim() || null;
}
