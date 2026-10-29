import { getDb } from '@/src/database/db';
import { notifyDatabaseChanged } from '@/src/database/dbEvents';
import { createOrUpdateCondition } from '@/src/features/conditions/conditionService';
import { createOrUpdateConsultation } from '@/src/features/consultations/consultationService';
import { createOrUpdateServiceRequest } from '@/src/features/service-requests/serviceRequestService';
import { createOrUpdateTreatment } from '@/src/features/treatments/treatmentService';
import type { ServiceRequestInput } from '@/src/features/service-requests/serviceRequestService';
import type { TreatmentInput } from '@/src/features/treatments/treatmentService';
import { planSave, type ConditionLink, type Review } from './proposals';

export interface SavedImport {
  /** Saved record IDs by proposal ref. */
  ids: Record<string, string>;
  /** The first saved consultation, to open after saving. */
  consultationId?: string;
}

/**
 * Saves the review's accepted proposals for the patient in one transaction,
 * so either every record and link is added or none is.
 */
export async function saveReview(
  review: Review,
  patientId: string
): Promise<SavedImport> {
  const steps = planSave(review);
  const ids: Record<string, string> = {};
  const conditionId = (link: ConditionLink) =>
    'existingId' in link ? link.existingId : ids[link.ref];
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const step of steps) {
      if (step.kind === 'condition') {
        const condition = await createOrUpdateCondition(
          { ...step.input, patientId },
          true
        );
        ids[step.ref] = condition.id!;
      } else if (step.kind === 'consultation') {
        const consultation = await createOrUpdateConsultation(
          {
            ...step.input,
            patientId,
            diagnoses: [
              ...(step.input.diagnoses ?? []),
              ...step.diagnoses.map((link) => ({
                title: link.title,
                conditionId: conditionId(link),
                terminology: link.terminology ?? {},
              })),
            ],
          },
          true
        );
        ids[step.ref] = consultation.id!;
      } else {
        const links = {
          patientId,
          consultationId: step.consultationRef
            ? ids[step.consultationRef]
            : undefined,
          reasonConditionIds: step.conditions.map(conditionId),
        };
        const saved =
          step.kind === 'serviceRequest'
            ? await createOrUpdateServiceRequest(
                { ...(step.input as ServiceRequestInput), ...links },
                true
              )
            : await createOrUpdateTreatment(
                { ...(step.input as TreatmentInput), ...links },
                true
              );
        ids[step.ref] = saved.id!;
      }
    }
  });
  notifyDatabaseChanged([
    'conditions',
    'organizations',
    'consultations',
    'consultation_conditions',
    'clinical_documents',
    'service_requests',
    'medication_requests',
  ]);
  const firstConsultation = steps.find((step) => step.kind === 'consultation');
  return {
    ids,
    consultationId: firstConsultation && ids[firstConsultation.ref],
  };
}
