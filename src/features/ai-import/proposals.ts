import type { ConditionInput } from '@/src/features/conditions/conditionService';
import type { ConsultationInput } from '@/src/features/consultations/consultationService';
import type { ServiceRequestInput } from '@/src/features/service-requests/serviceRequestService';
import type { TreatmentInput } from '@/src/features/treatments/treatmentService';
import { ICD_10_SYSTEM } from '@/src/features/consultations/consultationAIImport';
import { parseScheduleDraft } from '@/src/features/service-requests/serviceRequestSchedule';
import { parseLocalDate, toFhirLocalDateTime } from '@/src/utils/dateUtils';
import type {
  ImportedProposal,
  ImportedRecords,
  ProposalKind,
} from './aiImportFormat';

/**
 * A record the AI proposed, as the input its service saves. Links to other
 * proposals are kept by ref and resolved when the accepted ones are saved.
 */
export type Proposal = {
  ref: string;
  source: string | null;
  consultationRef: string | null;
  conditionRefs: string[];
} & (
  | { kind: 'consultation'; input: ConsultationInput }
  | { kind: 'condition'; input: ConditionInput }
  | { kind: 'serviceRequest'; input: ServiceRequestInput }
  | { kind: 'treatment'; input: TreatmentInput }
);

export type Decision = 'proposed' | 'accepted' | 'skipped';

export interface Review {
  summary: string | null;
  proposals: Proposal[];
  decisions: Record<string, Decision>;
  /**
   * For condition proposals: the patient's existing condition to use instead
   * of adding a new one, or null to add it.
   */
  existingConditions: Record<string, string | null>;
}

const toInput = (proposal: ImportedProposal): Proposal => {
  const links = {
    ref: proposal.ref,
    source: proposal.source,
    consultationRef: proposal.consultationRef,
    conditionRefs: proposal.conditionRefs,
  };
  switch (proposal.kind) {
    case 'consultation': {
      const { data } = proposal;
      return {
        ...links,
        kind: 'consultation',
        input: {
          title: data.title,
          status: data.status,
          date: toFhirLocalDateTime(parseLocalDate(data.date), data.time),
          doctorName: data.specialist ?? undefined,
          serviceProviderName: data.serviceProvider ?? undefined,
          serviceType: data.serviceType ?? undefined,
          notes: data.notes ?? undefined,
          diagnoses: [],
        },
      };
    }
    case 'condition': {
      const { data } = proposal;
      return {
        ...links,
        kind: 'condition',
        input: {
          title: data.title,
          clinicalStatus: data.clinicalStatus,
          verificationStatus: data.verificationStatus,
          onsetDate: data.onsetDate ?? undefined,
          notes: data.notes ?? undefined,
          ...(data.icd10 && {
            terminology: { system: ICD_10_SYSTEM, code: data.icd10 },
          }),
        },
      };
    }
    case 'serviceRequest': {
      const { data } = proposal;
      const draft = data.schedule;
      const schedule =
        draft &&
        parseScheduleDraft(draft, {
          period: Boolean(draft.period),
          periodMax: Boolean(draft.periodMax),
          count: Boolean(draft.count),
          duration: Boolean(draft.duration),
          timeOfDay: Boolean(draft.timeChoice || draft.time),
        });
      return {
        ...links,
        kind: 'serviceRequest',
        input: {
          title: data.title,
          category: data.category ?? undefined,
          intent: data.intent ?? undefined,
          status: data.status ?? undefined,
          authoredDate: data.authoredDate ?? undefined,
          plannedDate: data.plannedDate,
          // The reply was checked with the form's rules when it was read.
          schedule: typeof schedule === 'object' ? schedule : null,
          instructions: data.instructions,
          reason: data.reason,
          notes: data.notes,
          requesterName: data.requester,
        },
      };
    }
    case 'treatment': {
      const { data } = proposal;
      return {
        ...links,
        kind: 'treatment',
        input: {
          title: data.title,
          intent: data.intent ?? undefined,
          status: data.status ?? undefined,
          authoredDate: data.authoredDate ?? undefined,
          requesterName: data.requester,
          regimen: data.regimen,
          dosageInstructions: data.dosage,
          dispenseQuantity: data.dispenseQuantity,
          reason: data.reason,
          notes: data.notes,
        },
      };
    }
  }
};

export interface ExistingCondition {
  id: string;
  title: string;
  code?: string;
}

/**
 * The review of an import: every proposal still to be checked. A condition
 * the patient already has (same ICD-10 code or name) is offered in place of
 * a new one.
 */
export function startReview(
  records: ImportedRecords,
  existing: ExistingCondition[] = []
): Review {
  const proposals = records.proposals.map(toInput);
  const decisions: Record<string, Decision> = {};
  const existingConditions: Record<string, string | null> = {};
  for (const proposal of proposals) {
    decisions[proposal.ref] = 'proposed';
    if (proposal.kind === 'condition')
      existingConditions[proposal.ref] =
        findExistingConditions(proposal.input, existing)[0]?.id ?? null;
  }
  return { summary: records.summary, proposals, decisions, existingConditions };
}

/** The patient's conditions that look like the proposed one. */
export function findExistingConditions(
  input: ConditionInput,
  existing: ExistingCondition[]
): ExistingCondition[] {
  const code = input.terminology?.code?.trim().toUpperCase();
  const title = input.title.trim().toLowerCase();
  return existing.filter(
    (condition) =>
      (code && condition.code?.trim().toUpperCase() === code) ||
      condition.title.trim().toLowerCase() === title
  );
}

/** A link a card shows: to another proposal, or dropped because it is skipped. */
export interface ProposalLink {
  role: 'consultation' | 'diagnosis' | 'reason';
  /** The linked proposal. */
  target: Proposal;
  /** The target is skipped, so this link won't be saved. */
  dropped: boolean;
}

/** The links a proposal's card shows, in the order consultation, conditions. */
export function getProposalLinks(
  review: Review,
  proposal: Proposal
): ProposalLink[] {
  const byRef = new Map(review.proposals.map((p) => [p.ref, p]));
  const link = (role: ProposalLink['role'], target: Proposal) => ({
    role,
    target,
    dropped: review.decisions[target.ref] === 'skipped',
  });
  if (proposal.kind === 'consultation')
    return review.proposals
      .filter(
        (p) => p.kind === 'condition' && p.consultationRef === proposal.ref
      )
      .map((p) => link('diagnosis', p));
  const links: ProposalLink[] = [];
  const visit = proposal.consultationRef && byRef.get(proposal.consultationRef);
  if (visit) links.push(link('consultation', visit));
  for (const ref of proposal.conditionRefs) {
    const condition = byRef.get(ref);
    if (condition) links.push(link('reason', condition));
  }
  return links;
}

export function countDecisions(review: Review) {
  const values = Object.values(review.decisions);
  return {
    accepted: values.filter((d) => d === 'accepted').length,
    undecided: values.filter((d) => d === 'proposed').length,
    total: values.length,
  };
}

/** One record to save, with links to records saved before it or existing ones. */
export type SaveStep =
  | { kind: 'condition'; ref: string; input: ConditionInput }
  | {
      kind: 'consultation';
      ref: string;
      input: ConsultationInput;
      /** Diagnoses: refs of conditions saved earlier, or existing condition IDs. */
      diagnoses: ConditionLink[];
    }
  | {
      kind: 'serviceRequest' | 'treatment';
      ref: string;
      input: ServiceRequestInput | TreatmentInput;
      consultationRef: string | null;
      conditions: ConditionLink[];
    };

export type ConditionLink =
  | { ref: string; title: string; terminology?: ConditionInput['terminology'] }
  | {
      existingId: string;
      title: string;
      terminology?: ConditionInput['terminology'];
    };

const SAVE_ORDER: ProposalKind[] = [
  'condition',
  'consultation',
  'serviceRequest',
  'treatment',
];

/**
 * What saving the review adds, in an order where every link points at a
 * record saved before it. Only accepted proposals are saved; a link to one
 * that isn't accepted is left out. Conditions matched to an existing one are
 * linked to it instead of added.
 */
export function planSave(review: Review): SaveStep[] {
  const accepted = (ref: string | null) =>
    ref !== null && review.decisions[ref] === 'accepted';
  const byRef = new Map(review.proposals.map((p) => [p.ref, p]));
  const conditionLink = (ref: string): ConditionLink[] => {
    const condition = byRef.get(ref);
    if (!condition || condition.kind !== 'condition' || !accepted(ref))
      return [];
    const existingId = review.existingConditions[ref];
    const details = {
      title: condition.input.title,
      terminology: condition.input.terminology,
    };
    return [existingId ? { existingId, ...details } : { ref, ...details }];
  };
  const steps: SaveStep[] = [];
  for (const kind of SAVE_ORDER)
    for (const proposal of review.proposals) {
      if (proposal.kind !== kind || !accepted(proposal.ref)) continue;
      if (proposal.kind === 'condition') {
        if (!review.existingConditions[proposal.ref])
          steps.push({
            kind: 'condition',
            ref: proposal.ref,
            input: proposal.input,
          });
      } else if (proposal.kind === 'consultation') {
        steps.push({
          kind: 'consultation',
          ref: proposal.ref,
          input: proposal.input,
          diagnoses: review.proposals
            .filter(
              (p) =>
                p.kind === 'condition' && p.consultationRef === proposal.ref
            )
            .flatMap((p) => conditionLink(p.ref)),
        });
      } else {
        steps.push({
          kind: proposal.kind,
          ref: proposal.ref,
          input: proposal.input,
          consultationRef: accepted(proposal.consultationRef)
            ? proposal.consultationRef
            : null,
          conditions: proposal.conditionRefs.flatMap(conditionLink),
        });
      }
    }
  return steps;
}
