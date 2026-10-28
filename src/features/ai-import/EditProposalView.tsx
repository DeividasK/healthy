import React from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ServiceRequest } from 'fhir/r5';
import { ConditionForm } from '@/src/features/conditions/ConditionForm';
import { ConsultationForm } from '@/src/features/consultations/ConsultationForm';
import { ServiceRequestForm } from '@/src/features/service-requests/ServiceRequestForm';
import { SNOMED_SYSTEM } from '@/src/features/service-requests/serviceRequestLabels';
import {
  toScheduleDraft,
  withSchedule,
} from '@/src/features/service-requests/serviceRequestSchedule';
import { TreatmentForm } from '@/src/features/treatments/TreatmentForm';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import { goBackOr } from '@/src/utils/navigation';
import { AIImportReviewView } from './AIImportReviewView';
import { editProposal, useReview } from './reviewStore';

const blurActive = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined')
    (document.activeElement as HTMLElement)?.blur?.();
};

const optionalDate = (date?: string | null) =>
  date ? parseLocalDate(date.slice(0, 10)) : undefined;

/**
 * One proposed record in its full form, filled in. Saving returns the change
 * to its card in the review; nothing is stored until the review is added.
 * Links are kept on the card.
 */
export function EditProposalView() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const { activePatientId } = useActivePatient();
  const review = useReview(activePatientId);
  const proposal = review?.proposals.find((p) => p.ref === ref);
  // Without the proposal (e.g. after a reload) the review explains itself.
  if (!proposal) return <AIImportReviewView />;
  const back = () => {
    blurActive();
    goBackOr(router, '/ai-import');
  };

  switch (proposal.kind) {
    case 'consultation': {
      const { input } = proposal;
      return (
        <ConsultationForm
          proposal
          initialValues={{
            title: input.title,
            status: input.status,
            date: parseLocalDate(input.date.slice(0, 10)),
            time: input.date.includes('T') ? input.date.slice(11, 16) : null,
            doctorName: input.doctorName,
            serviceProviderName: input.serviceProviderName ?? undefined,
            serviceType: input.serviceType,
            reasonConditionIds: input.reasonConditionIds,
            diagnoses: input.diagnoses,
            notes: input.notes,
          }}
          // The form returns to the review once saved.
          onSave={async (values) => editProposal(proposal.ref, values)}
        />
      );
    }
    case 'condition': {
      const { input } = proposal;
      return (
        <ConditionForm
          proposal
          initialValues={{
            title: input.title,
            clinicalStatus: input.clinicalStatus,
            verificationStatus: input.verificationStatus,
            category: input.category ?? '',
            onsetDate: optionalDate(input.onsetDate),
            severity: input.severity,
            bodySite: input.bodySite,
            abatementDate: optionalDate(input.abatementDate),
            notes: input.notes,
          }}
          onSave={async (values) =>
            // The form has no code field, so the proposal's code is kept.
            editProposal(proposal.ref, {
              ...values,
              terminology: input.terminology,
            })
          }
        />
      );
    }
    case 'serviceRequest': {
      const { input } = proposal;
      return (
        <ServiceRequestForm
          proposal
          initialValues={{
            title: input.title,
            intent: input.intent,
            status: input.status,
            authoredDate: optionalDate(input.authoredDate),
            plannedDate: optionalDate(input.plannedDate) ?? null,
            scheduleDraft: input.schedule
              ? toScheduleDraft({
                  occurrenceTiming: {
                    repeat: withSchedule(undefined, input.schedule),
                  },
                } as ServiceRequest)
              : undefined,
            requesterName: input.requesterName,
            instructions: input.instructions,
            reason: input.reason,
            notes: input.notes,
          }}
          initialCategory={
            input.category
              ? { coding: [{ system: SNOMED_SYSTEM, code: input.category }] }
              : undefined
          }
          onSubmit={async (values) => {
            editProposal(proposal.ref, {
              ...input,
              title: values.title,
              // An unchanged category comes back as undefined.
              category: values.category ?? input.category,
              intent: values.intent,
              status: values.status,
              authoredDate: values.authoredDate
                ? formatLocalDate(values.authoredDate)
                : undefined,
              plannedDate: values.plannedDate
                ? formatLocalDate(values.plannedDate)
                : null,
              schedule: values.schedule,
              instructions: values.instructions,
              reason: values.reason,
              notes: values.notes,
              requesterName: values.requesterName,
            });
            back();
          }}
        />
      );
    }
    case 'treatment': {
      const { input } = proposal;
      return (
        <TreatmentForm
          proposal
          initialValues={{
            title: input.title,
            intent: input.intent,
            status: input.status,
            authoredDate: optionalDate(input.authoredDate),
            requesterName: input.requesterName,
            dosageInstructions: input.dosageInstructions,
            regimen: input.regimen,
            dispenseQuantity: input.dispenseQuantity,
            reason: input.reason,
            notes: input.notes,
            usageStart: optionalDate(input.usageStart),
          }}
          onSubmit={async (values) => {
            editProposal(proposal.ref, {
              ...input,
              title: values.title,
              intent: values.intent,
              status: values.status,
              authoredDate: values.authoredDate
                ? formatLocalDate(values.authoredDate)
                : undefined,
              // The form omits unchanged dosing (undefined); null removes it.
              dosageInstructions:
                values.dosageInstructions === undefined
                  ? input.dosageInstructions
                  : values.dosageInstructions,
              regimen:
                values.regimen === undefined ? input.regimen : values.regimen,
              dispenseQuantity:
                values.dispenseQuantity === undefined
                  ? input.dispenseQuantity
                  : values.dispenseQuantity,
              reason: values.reason,
              notes: values.notes,
              requesterName: values.requesterName,
              usageStart: values.usageStart
                ? formatLocalDate(values.usageStart)
                : undefined,
            });
            back();
          }}
        />
      );
    }
  }
}
