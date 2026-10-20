import * as Crypto from 'expo-crypto';
import type { RequestOrchestration } from 'fhir/r5';
import {
  deleteRequestOrchestrationRecord,
  fetchRequestOrchestrationById,
  fetchRequestOrchestrationsByPatientId,
  insertRequestOrchestrationRecord,
} from './bundlesRepository';
import {
  buildBundle,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
  withoutMember,
  type BundleValues,
} from './bundleModel';

export const getBundleById = (id: string, patientId: string) =>
  fetchRequestOrchestrationById(id, patientId);

export const getAllBundles = (patientId: string) =>
  fetchRequestOrchestrationsByPatientId(patientId);

/** The patient's bundles that include the treatment. */
export async function getBundlesWithTreatment(
  treatmentId: string,
  patientId: string
): Promise<RequestOrchestration[]> {
  return (await getAllBundles(patientId)).filter((bundle) =>
    getBundleMemberIds(bundle).includes(treatmentId)
  );
}

/** The patient's bundles as link options. */
export async function getBundleLinkOptions(patientId: string) {
  return (await getAllBundles(patientId)).flatMap((bundle) =>
    bundle.id ? [{ id: bundle.id, label: getBundleTitle(bundle) }] : []
  );
}

/** Creates or updates a bundle; returns its id. */
export async function saveBundle(
  values: BundleValues & { id?: string; patientId: string }
): Promise<string> {
  if (!values.title.trim()) throw new Error('Bundle name is required');
  if (!values.memberIds.length)
    throw new Error('Choose at least one treatment');
  const id = values.id || `bundle-${Crypto.randomUUID()}`;
  const existing = values.id
    ? await fetchRequestOrchestrationById(values.id, values.patientId)
    : null;
  await insertRequestOrchestrationRecord(
    buildBundle(values, { id, patientId: values.patientId, existing }),
    values.patientId
  );
  return id;
}

/**
 * Adds a treatment to a bundle or removes it. A bundle left without
 * treatments is deleted.
 */
export async function setTreatmentInBundle(
  treatmentId: string,
  bundleId: string,
  patientId: string,
  included: boolean
): Promise<void> {
  const bundle = await fetchRequestOrchestrationById(bundleId, patientId);
  if (!bundle) throw new Error(`Bundle ${bundleId} not found`);
  const memberIds = getBundleMemberIds(bundle);
  if (memberIds.includes(treatmentId) === included) return;
  if (!included) {
    const next = withoutMember(bundle, treatmentId);
    if (!next) return deleteBundle(bundleId, patientId);
  }
  await saveBundle({
    id: bundleId,
    patientId,
    title: getBundleTitle(bundle),
    times: getBundleTimes(bundle),
    memberIds: included
      ? [...memberIds, treatmentId]
      : memberIds.filter((id) => id !== treatmentId),
  });
}

export const deleteBundle = (id: string, patientId: string) =>
  deleteRequestOrchestrationRecord(id, patientId);
