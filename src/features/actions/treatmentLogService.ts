import type { MedicationAdministration, MedicationRequest } from 'fhir/r5';
import { getAllTreatments } from '@/src/features/treatments/treatmentService';
import {
  deleteMedicationAdministrationRecord,
  fetchMedicationAdministrationsInRange,
  insertMedicationAdministrationRecord,
} from './medicationAdministrationsRepository';
import {
  buildActionDay,
  type ActionDay,
  type TreatmentLogAnswer,
} from './actionDays';

/** The treatments to answer and the answers given on each of `dates`. */
export async function getActionDays(
  patientId: string,
  dates: string[]
): Promise<ActionDay[]> {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const [treatments, administrations] = await Promise.all([
    getAllTreatments(patientId),
    fetchMedicationAdministrationsInRange(
      patientId,
      sorted[0],
      sorted[sorted.length - 1]
    ),
  ]);
  return dates.map((date) => buildActionDay(date, treatments, administrations));
}

/**
 * Records whether a treatment was taken on a day, or clears the answer.
 *
 * One MedicationAdministration per treatment and day, with an id derived from
 * both, so answers given on several devices update the same resource. An
 * existing log is updated in place, keeping fields this screen does not show.
 */
export async function setTreatmentLog(
  treatment: MedicationRequest,
  date: string,
  answer: TreatmentLogAnswer | null,
  patientId: string,
  existing?: MedicationAdministration
): Promise<void> {
  if (!treatment.id) throw new Error('Treatment requires an id');
  if (!answer) {
    if (existing?.id)
      await deleteMedicationAdministrationRecord(existing.id, patientId);
    return;
  }
  const administration: MedicationAdministration = {
    ...existing,
    resourceType: 'MedicationAdministration',
    id: existing?.id ?? `${treatment.id}-${date}`,
    status: answer === 'taken' ? 'completed' : 'not-done',
    medication: existing?.medication ?? treatment.medication,
    subject: { reference: `Patient/${patientId}` },
    request: { reference: `MedicationRequest/${treatment.id}` },
    meta: { ...existing?.meta, lastUpdated: new Date().toISOString() },
  };
  // R5 spells this element `occurence[x]`.
  if (!existing) administration.occurenceDateTime = date;
  await insertMedicationAdministrationRecord(administration, patientId);
}
