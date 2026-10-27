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
  getBundleActivityIds,
  getBundleMemberIds,
  getBundleTimes,
  getBundleTitle,
  withoutMember,
  type BundleValues,
} from './bundleModel';
import { fetchMedicationRequestsByPatientId } from '@/src/features/treatments/treatmentsRepository';
import {
  getMaxBundles,
  getRegimenDraft,
} from '@/src/features/treatments/regimen';
import { getTreatmentTitle } from '@/src/utils/fhirUtils';

export const getBundleById = (id: string, patientId: string) =>
  fetchRequestOrchestrationById(id, patientId);

export const getAllBundles = (patientId: string) =>
  fetchRequestOrchestrationsByPatientId(patientId);

/** The patient's bundles that include the activity (service request). */
export async function getBundlesWithActivity(
  requestId: string,
  patientId: string
): Promise<RequestOrchestration[]> {
  return (await getAllBundles(patientId)).filter((bundle) =>
    getBundleActivityIds(bundle).includes(requestId)
  );
}

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

interface TreatmentAtLimit {
  id: string;
  title: string;
}

/**
 * The patient's treatments that cannot join another bundle: each is already
 * in as many bundles as its regimen has doses (one without a regimen). The
 * bundle `exceptId`, e.g. the one being edited, is not counted.
 */
export async function getTreatmentsAtBundleLimit(
  patientId: string,
  exceptId?: string
): Promise<TreatmentAtLimit[]> {
  const [treatments, bundles] = await Promise.all([
    fetchMedicationRequestsByPatientId(patientId),
    getAllBundles(patientId),
  ]);
  const counts = new Map<string, number>();
  for (const bundle of bundles)
    if (bundle.id !== exceptId)
      for (const id of getBundleMemberIds(bundle))
        counts.set(id, (counts.get(id) ?? 0) + 1);
  return treatments.flatMap((treatment) =>
    treatment.id &&
    (counts.get(treatment.id) ?? 0) >= getMaxBundles(getRegimenDraft(treatment))
      ? [{ id: treatment.id, title: getTreatmentTitle(treatment) }]
      : []
  );
}

/** Creates or updates a bundle; returns its id. */
export async function saveBundle(
  values: BundleValues & { id?: string; patientId: string }
): Promise<string> {
  if (!values.title.trim()) throw new Error('Bundle name is required');
  const id = values.id || `bundle-${Crypto.randomUUID()}`;
  const existing = values.id
    ? await fetchRequestOrchestrationById(values.id, values.patientId)
    : null;
  const added = values.memberIds.filter(
    (memberId) => !(existing && getBundleMemberIds(existing).includes(memberId))
  );
  if (added.length) {
    const full = (await getTreatmentsAtBundleLimit(values.patientId, id)).find(
      (treatment) => added.includes(treatment.id)
    );
    if (full)
      throw new Error(
        `${full.title} is already in as many bundles as it has doses`
      );
  }
  const bundle = buildBundle(values, {
    id,
    patientId: values.patientId,
    existing,
  });
  if (
    !getBundleMemberIds(bundle).length &&
    !getBundleActivityIds(bundle).length
  )
    throw new Error('Choose at least one treatment or activity');
  await insertRequestOrchestrationRecord(bundle, values.patientId);
  return id;
}

/**
 * Adds a treatment to a bundle or removes it. A bundle left without
 * treatments or activities is deleted.
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
    const next = withoutMember(bundle, `MedicationRequest/${treatmentId}`);
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
