import * as Crypto from 'expo-crypto';
import type { Dosage, MedicationRequest } from 'fhir/r5';
import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import {
  deleteMedicationStatementRecord,
  fetchMedicationStatements,
  insertMedicationStatementRecord,
} from './medicationStatementsRepository';
import {
  getLatestRegimen,
  getUsagePeriods,
  planUsageChange,
  planUsageRemoval,
  type UsageAction,
  type UsageChangePlan,
  type UsagePeriod,
} from './treatmentUsage';
import { todayKey } from './actionDays';

/** A treatment's periods of use, oldest first. */
export async function getTreatmentUsage(
  patientId: string,
  treatmentId: string
): Promise<UsagePeriod[]> {
  return getUsagePeriods(
    await fetchMedicationStatements(patientId, treatmentId),
    treatmentId
  );
}

async function applyPlan(plan: UsageChangePlan, patientId: string) {
  if (!plan.save.length && !plan.remove.length) return;
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const id of plan.remove)
      await deleteMedicationStatementRecord(id, patientId, true);
    for (const statement of plan.save)
      await insertMedicationStatementRecord(statement, patientId, true);
  });
  notifyDatabaseChanged(['medication_statements']);
}

/**
 * Records starting, pausing, resuming or stopping a treatment, or a new
 * regimen while taking it, on `date` (YYYY-MM-DD) as MedicationStatement
 * periods. Throws when the date is in the future or before the current
 * period.
 */
export async function changeTreatmentUsage(
  treatment: MedicationRequest,
  patientId: string,
  action: UsageAction,
  date: string,
  reason?: string,
  notes?: string,
  /**
   * The regimen followed from `date` when taking it; required for `change`.
   * Without it, starting or resuming continues the regimen last followed.
   */
  dosage?: Dosage[]
): Promise<void> {
  if (!treatment.id) throw new Error('Treatment requires an id');
  if (action === 'change' && !dosage?.length)
    throw new Error('Enter the new dosage or regimen');
  const periods = await getTreatmentUsage(patientId, treatment.id);
  const plan = planUsageChange(
    periods,
    action,
    date,
    todayKey(),
    `use-${Crypto.randomUUID()}`,
    treatment,
    patientId,
    reason,
    notes,
    dosage ?? getLatestRegimen(periods, treatment)
  );
  if ('error' in plan) throw new Error(plan.error);
  await applyPlan(plan, patientId);
}

/** Removes one period of a treatment's usage, closing the gap it leaves. */
export async function removeTreatmentUsage(
  treatmentId: string,
  statementId: string,
  patientId: string
): Promise<void> {
  await applyPlan(
    planUsageRemoval(
      await getTreatmentUsage(patientId, treatmentId),
      statementId
    ),
    patientId
  );
}
