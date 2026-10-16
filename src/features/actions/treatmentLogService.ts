import type { MedicationAdministration } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { getAllTreatments } from '@/src/features/treatments/treatmentService';
import {
  deleteMedicationAdministrationRecord,
  fetchMedicationAdministrationsInRange,
  insertMedicationAdministrationRecord,
} from './medicationAdministrationsRepository';
import {
  buildActionDay,
  type ActionDay,
  type ActionItem,
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
 * Records whether a treatment, or one scheduled dose of it, was taken on a
 * day, or clears the answer.
 *
 * One MedicationAdministration per item and day, with an id derived from both
 * (see `getTreatmentLogId`), so answers given on several devices update the
 * same resource. A dose's log carries the dose in `dosage`. An existing log is
 * updated in place, keeping fields this screen does not show.
 */
export async function setTreatmentLog(
  item: Pick<ActionItem, 'key' | 'treatment' | 'dose' | 'log'>,
  date: string,
  answer: TreatmentLogAnswer | null,
  patientId: string,
  withinTransaction: boolean = false
): Promise<void> {
  const { treatment, dose, log: existing } = item;
  if (!treatment.id) throw new Error('Treatment requires an id');
  if (!answer) {
    if (existing?.id)
      await deleteMedicationAdministrationRecord(
        existing.id,
        patientId,
        withinTransaction
      );
    return;
  }
  const administration: MedicationAdministration = {
    ...existing,
    resourceType: 'MedicationAdministration',
    id: existing?.id ?? item.key,
    status: answer === 'taken' ? 'completed' : 'not-done',
    medication: existing?.medication ?? treatment.medication,
    subject: { reference: `Patient/${patientId}` },
    request: { reference: `MedicationRequest/${treatment.id}` },
    meta: { ...existing?.meta, lastUpdated: new Date().toISOString() },
  };
  if (!existing) {
    // R5 spells this element `occurence[x]`.
    administration.occurenceDateTime = date;
    if (dose) administration.dosage = getAdministeredDosage(dose);
  }
  await insertMedicationAdministrationRecord(
    administration,
    patientId,
    withinTransaction
  );
}

/**
 * Records several answers on one day together, e.g. those copied from the
 * previous day: one transaction and one refresh, so they appear at once.
 */
export async function setTreatmentLogs(
  changes: {
    item: Pick<ActionItem, 'key' | 'treatment' | 'dose' | 'log'>;
    answer: TreatmentLogAnswer | null;
  }[],
  date: string,
  patientId: string
): Promise<void> {
  if (!changes.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const { item, answer } of changes)
      await setTreatmentLog(item, date, answer, patientId, true);
  });
  notifyDatabaseChanged(['medication_administrations']);
}

/** `MedicationAdministration.dosage` for a scheduled dose. */
function getAdministeredDosage(
  dose: NonNullable<ActionItem['dose']>
): MedicationAdministration['dosage'] {
  const quantity = dose.dosage?.doseAndRate?.[0]?.doseQuantity;
  return {
    text: dose.text,
    ...(dose.dosage?.route && { route: dose.dosage.route }),
    ...(dose.dosage?.site && { site: dose.dosage.site }),
    ...(quantity && { dose: quantity }),
  };
}
