import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Quote } from 'lucide-react-native';
import type { ServiceRequest } from 'fhir/r5';
import { NativeSelect } from '@/src/components/NativeSelect';
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
import { COLORS } from '@/src/theme/colors';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import { goBackOr } from '@/src/utils/navigation';
import { useExistingConditions } from './existingConditions';
import {
  findExistingConditions,
  type Proposal,
  type Review,
} from './proposals';
import {
  chooseExistingCondition,
  editProposal,
  useReview,
} from './reviewStore';

const blurActive = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined')
    (document.activeElement as HTMLElement)?.blur?.();
};

const optionalDate = (date?: string | null) =>
  date ? parseLocalDate(date.slice(0, 10)) : undefined;

/**
 * One proposed record in its full form, filled in. Saving returns the change
 * to its row in the review; nothing is stored until the review is added.
 * Links are kept on the row.
 */
export function EditProposalView({
  proposalRef,
  onDone,
}: {
  /** The proposal to edit beside the review, instead of the route's. */
  proposalRef?: string;
  /** Called once saved, instead of going back to the review. */
  onDone?: () => void;
} = {}) {
  const params = useLocalSearchParams<{ ref?: string }>();
  const ref = proposalRef ?? params.ref;
  const { activePatientId } = useActivePatient();
  const review = useReview(activePatientId);
  const proposal = review?.proposals.find((p) => p.ref === ref);
  // Without the proposal (e.g. after a reload) the review explains itself.
  if (!review || !proposal) return <Redirect href="/ai-import" />;
  return (
    <ProposalForm
      proposal={proposal}
      context={<ProposalContext proposal={proposal} review={review} />}
      onDone={onDone}
    />
  );
}

/** Where the record came from and, for a diagnosis, which condition it is. */
function ProposalContext({
  proposal,
  review,
}: {
  proposal: Proposal;
  review: Review;
}) {
  const { activePatientId } = useActivePatient();
  const existing = useExistingConditions(activePatientId);
  const matches =
    proposal.kind === 'condition'
      ? findExistingConditions(proposal.input, existing)
      : [];
  if (!proposal.source && !matches.length) return null;
  return (
    <View style={styles.context}>
      {proposal.source && (
        <View style={styles.sourceRow}>
          <Quote size={13} color={COLORS.light.muted} />
          <Text style={styles.sourceText} testID="ai-import-edit-source">
            From “{proposal.source}” in your document
          </Text>
        </View>
      )}
      {matches.length > 0 && (
        <View style={styles.existing}>
          <Text style={styles.existingLabel}>Save as</Text>
          <NativeSelect
            testID={`ai-import-existing-${proposal.ref}`}
            name={`existing-${proposal.ref}`}
            label="Save as"
            value={review.existingConditions[proposal.ref] ?? ''}
            options={[
              ...matches.map((match) => ({
                id: match.id,
                label: `Your condition: ${match.title}`,
              })),
              { id: '', label: 'New condition' },
            ]}
            onChange={(id) => chooseExistingCondition(proposal.ref, id || null)}
          />
        </View>
      )}
    </View>
  );
}

function ProposalForm({
  proposal,
  context,
  onDone,
}: {
  proposal: Proposal;
  context: React.ReactNode;
  onDone?: () => void;
}) {
  const router = useRouter();
  const back = () => {
    blurActive();
    if (onDone) onDone();
    else goBackOr(router, '/ai-import');
  };

  switch (proposal.kind) {
    case 'consultation': {
      const { input } = proposal;
      return (
        <ConsultationForm
          proposal
          proposalContext={context}
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
          onSave={async (values) => {
            editProposal(proposal.ref, values);
            back();
          }}
        />
      );
    }
    case 'condition': {
      const { input } = proposal;
      return (
        <ConditionForm
          proposal
          proposalContext={context}
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
          onSave={async (values) => {
            // The form has no code field, so the proposal's code is kept.
            editProposal(proposal.ref, {
              ...values,
              terminology: input.terminology,
            });
            back();
          }}
        />
      );
    }
    case 'serviceRequest': {
      const { input } = proposal;
      return (
        <ServiceRequestForm
          proposal
          proposalContext={context}
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
          proposalContext={context}
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

const styles = StyleSheet.create({
  context: { gap: 12, marginBottom: 16 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.light.mutedForeground,
  },
  existing: { gap: 4 },
  existingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
  },
});
