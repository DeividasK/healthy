import { useSyncExternalStore } from 'react';
import type { Decision, Proposal, Review } from './proposals';

/**
 * The import being reviewed. It is kept in memory only: health data read
 * from the AI's reply is stored nowhere until the user saves it.
 */
let current: Review | null = null;
/** The profile the review is for; another profile shows no review. */
let currentPatientId: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export function setReview(review: Review | null, patientId?: string) {
  current = review;
  currentPatientId = review ? (patientId ?? null) : null;
  emit();
}

export const getReview = () => current;

function update(change: (review: Review) => Review) {
  if (!current) return;
  current = change(current);
  emit();
}

export const decide = (ref: string, decision: Decision) =>
  update((review) => ({
    ...review,
    decisions: { ...review.decisions, [ref]: decision },
  }));

export const chooseExistingCondition = (ref: string, id: string | null) =>
  update((review) => ({
    ...review,
    existingConditions: { ...review.existingConditions, [ref]: id },
  }));

/** Replaces a proposal's record with the user's edit, keeping its links. */
export const editProposal = (ref: string, input: Proposal['input']) =>
  update((review) => ({
    ...review,
    proposals: review.proposals.map((proposal) =>
      proposal.ref === ref ? ({ ...proposal, input } as Proposal) : proposal
    ),
  }));

/** The review for the patient, or null when there is none for them. */
export function useReview(patientId: string): Review | null {
  const review = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => current
  );
  return currentPatientId === patientId ? review : null;
}
