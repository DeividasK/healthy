import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, Link2, Unlink, UserCheck } from 'lucide-react-native';
import {
  InlineFormContext,
  type InlineForm,
} from '@/src/components/FormActionDock';
import {
  MenuPlacementContext,
  type MenuPlacement,
} from '@/src/components/FloatingAddMenu';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { ListDetailLayout } from '@/src/components/ListDetailLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import {
  ResourceRow,
  ResourceSection,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { AnswerButtons } from '@/src/features/actions/AnswerButtons';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN, useIsWideLayout } from '@/src/theme/layout';
import type { ProposalKind } from './aiImportFormat';
import { saveReview } from './aiImportSave';
import { EditProposalView } from './EditProposalView';
import { useExistingConditions } from './existingConditions';
import {
  countDecisions,
  findExistingConditions,
  getProposalLinks,
  type Decision,
  type ExistingCondition,
  type Proposal,
  type ProposalLink,
  type Review,
} from './proposals';
import {
  PROPOSAL_KINDS,
  getProposalDosing,
  getProposalMeta,
} from './proposalMeta';
import { decide, getReview, setReview, useReview } from './reviewStore';

const SECTIONS: { kind: ProposalKind; title: string }[] = [
  { kind: 'consultation', title: 'Consultations' },
  { kind: 'condition', title: 'Diagnoses' },
  { kind: 'serviceRequest', title: 'Service requests' },
  { kind: 'treatment', title: 'Treatments' },
];

/**
 * The records the user's AI proposed from a document, as rows to accept or
 * skip, grouped by kind. A row opens its edit form, beside the list on
 * desktop. Nothing is saved until every row is decided and the user adds the
 * accepted ones, together and linked.
 */
export function AIImportReviewView() {
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const review = useReview(activePatientId);
  const wide = useIsWideLayout();
  const existing = useExistingConditions(activePatientId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Desktop starts on the first row to check, and stays on the chosen row
  // while rows are decided.
  const [selectedRef, setSelectedRef] = useState(
    () =>
      review?.proposals.find(
        (proposal) => review.decisions[proposal.ref] === 'proposed'
      )?.ref
  );
  // The form beside the list, and what to do once it is saved.
  const form = useRef<InlineForm | null>(null);
  const screen = useRef<View>(null);
  const afterSave = useRef<(() => void) | null>(null);
  // Reopens the form once saved, so its changes become its starting point.
  const [formVersion, setFormVersion] = useState(0);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement | null>(
    null
  );
  const inlineForm = useMemo(
    () => ({
      bind: (inline: InlineForm) => {
        form.current = inline;
      },
      // Menus centre on the screen beside the sidebar, so the form's + menu
      // is placed from the screen's middle and bottom.
      placeMenu: (add: { x: number; y: number; width: number }) =>
        screen.current?.measureInWindow((x, y, width, height) =>
          setMenuPlacement({
            shift: add.x + add.width / 2 - (x + width / 2),
            bottom: y + height - add.y + 8,
          })
        ),
    }),
    []
  );

  if (!review)
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.column}>
          <ScreenHeading>Check what AI found</ScreenHeading>
          <Text style={styles.summary} testID="ai-import-review-empty">
            There is nothing to check. Use Import with AI on Home to add records
            from a document.
          </Text>
        </ScrollView>
        <ResourceActionDock showBack />
      </SafeAreaView>
    );

  const { accepted, undecided, total } = countDecisions(review);
  const selected =
    review.proposals.find((proposal) => proposal.ref === selectedRef) ??
    review.proposals[0];

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      // The latest review, with any edit the form beside it just saved.
      const saved = await saveReview(getReview() ?? review, activePatientId);
      setReview(null);
      router.replace(
        saved.consultationId ? `/consultation/${saved.consultationId}` : '/'
      );
    } catch (err) {
      console.error('Failed to save the imported records:', err);
      setError('The records could not be added. Please try again.');
      setIsSaving(false);
    }
  };

  // Unsaved changes in the form beside the list are saved, not lost; if they
  // are not valid the form shows why and stays open.
  const afterForm = (next: () => void) => {
    if (wide && form.current?.hasChanges) {
      afterSave.current = next;
      form.current.save();
    } else next();
  };
  const handleFormSaved = () => {
    setFormVersion((version) => version + 1);
    const next = afterSave.current;
    afterSave.current = null;
    next?.();
  };

  const open = (proposal: Proposal) => {
    if (wide) {
      if (proposal.ref !== selected.ref)
        afterForm(() => setSelectedRef(proposal.ref));
    } else
      router.push({
        pathname: '/ai-import/edit',
        params: { ref: proposal.ref },
      });
  };

  const list = (
    <>
      {review.summary && (
        <Text style={styles.summary} testID="ai-import-summary">
          {review.summary}
        </Text>
      )}
      <Text style={styles.progress} testID="ai-import-progress">
        {[
          `${accepted} of ${total} accepted`,
          undecided > 0 && `${undecided} to check`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>
      {error && <FormErrorBanner message={error} testID="ai-import-error" />}
      {SECTIONS.map(({ kind, title }) => {
        const proposals = review.proposals.filter(
          (proposal) => proposal.kind === kind
        );
        return (
          <ResourceSection
            key={kind}
            icon={PROPOSAL_KINDS[kind].icon}
            title={title}
            count={proposals.length}
            testID={`ai-import-section-${kind}`}
          >
            {proposals.map((proposal) => (
              <ProposalRow
                key={proposal.ref}
                proposal={proposal}
                review={review}
                existing={existing}
                selected={wide && proposal.ref === selected.ref}
                onOpen={() => open(proposal)}
              />
            ))}
          </ResourceSection>
        );
      })}
    </>
  );

  const dock = (
    <ResourceActionDock
      showBack
      actions={[
        {
          label:
            undecided > 0
              ? `Accept or skip ${undecided} more to add records`
              : `Add ${accepted} ${accepted === 1 ? 'record' : 'records'}`,
          testID: 'ai-import-add-button',
          icon: Check,
          primary: true,
          disabled: undecided > 0 || accepted === 0,
          busy: isSaving,
          onPress: () => afterForm(handleSave),
        },
      ]}
    />
  );

  if (wide)
    return (
      <SafeAreaView
        ref={screen}
        style={styles.safeArea}
        edges={['left', 'right', 'bottom']}
      >
        <ListDetailLayout
          title="Check what AI found"
          listId="ai-import-list"
          rowSelector='[data-testid^="ai-import-row-"][data-testid$="-open"]'
          testID="ai-import-review"
          list={list}
          detail={
            <InlineFormContext.Provider value={inlineForm}>
              <MenuPlacementContext.Provider value={menuPlacement}>
                <EditProposalView
                  key={`${selected.ref}-${formVersion}`}
                  proposalRef={selected.ref}
                  onDone={handleFormSaved}
                />
              </MenuPlacementContext.Provider>
            </InlineFormContext.Provider>
          }
          dock={dock}
        />
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.column}
        testID="ai-import-review"
      >
        <ScreenHeading>Check what AI found</ScreenHeading>
        {list}
      </ScrollView>
      {dock}
    </SafeAreaView>
  );
}

/** A link in words, e.g. "Planned in Cardiology review". */
function linkText(proposal: Proposal, { role, target, dropped }: ProposalLink) {
  const title = target.input.title;
  if (dropped) return `Not linked: ${title} is skipped`;
  if (role === 'diagnosis') return `Diagnosis: ${title}`;
  if (role === 'reason') return `Reason: ${title}`;
  return proposal.kind === 'condition'
    ? `Diagnosed in ${title}`
    : `Planned in ${title}`;
}

const ANSWERS: Record<Decision, 'taken' | 'not-taken' | null> = {
  accepted: 'taken',
  skipped: 'not-taken',
  proposed: null,
};

/**
 * A proposed record as a list row: its details and links, with skip (✕) and
 * accept (✓) like a journal row. Pressing the chosen button again undoes it.
 */
function ProposalRow({
  proposal,
  review,
  existing,
  selected,
  onOpen,
}: {
  proposal: Proposal;
  review: Review;
  existing: ExistingCondition[];
  selected: boolean;
  onOpen: () => void;
}) {
  const decision = review.decisions[proposal.ref];
  const chosenExisting = review.existingConditions[proposal.ref];
  const match =
    proposal.kind === 'condition' && chosenExisting
      ? findExistingConditions(proposal.input, existing).find(
          (condition) => condition.id === chosenExisting
        )
      : undefined;
  const dosing = getProposalDosing(proposal);
  const meta: ResourceMeta[] = [
    ...getProposalMeta(proposal),
    ...(match
      ? [{ icon: UserCheck, text: `Saved as your ${match.title}` }]
      : []),
    ...getProposalLinks(review, proposal).map((link) => ({
      icon: link.dropped ? Unlink : Link2,
      text: linkText(proposal, link),
      // A lost link is a warning in words and icon, not colour alone.
      ...(link.dropped && { tone: 'warning' as const }),
    })),
  ];
  return (
    <ResourceRow
      testID={`ai-import-row-${proposal.ref}`}
      title={proposal.input.title}
      description={dosing.length ? dosing.join(' · ') : undefined}
      meta={meta}
      dimmed={decision === 'skipped'}
      selected={selected}
      onPress={onOpen}
      accessory={
        <AnswerButtons
          answer={ANSWERS[decision]}
          name={proposal.input.title}
          labels={{ taken: 'accepted', notTaken: 'skipped' }}
          testIDPrefix={{ prefix: 'ai-import-row', rowId: proposal.ref }}
          onAnswer={(answer) =>
            decide(
              proposal.ref,
              answer === 'taken'
                ? 'accepted'
                : answer === 'not-taken'
                  ? 'skipped'
                  : 'proposed'
            )
          }
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.light.background },
  scroll: { flex: 1 },
  column: { ...CONTENT_COLUMN, padding: 20, paddingBottom: 132 },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.mutedForeground,
    marginBottom: 8,
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
    marginBottom: 12,
  },
});
