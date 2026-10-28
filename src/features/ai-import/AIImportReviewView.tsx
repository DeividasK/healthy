import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Check,
  Link2,
  Pencil,
  Quote,
  Undo2,
  Unlink,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import type { Condition } from 'fhir/r5';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { IconDisc } from '@/src/components/IconDisc';
import { NativeSelect } from '@/src/components/NativeSelect';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceMetaLine } from '@/src/components/ResourceSection';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { CONTENT_COLUMN, useIsWideLayout } from '@/src/theme/layout';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { saveReview } from './aiImportSave';
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
import {
  chooseExistingCondition,
  decide,
  setReview,
  useReview,
} from './reviewStore';

/** The patient's conditions as the review matches them. */
export const toExistingConditions = (
  conditions: Condition[]
): ExistingCondition[] =>
  conditions.map((condition) => ({
    id: condition.id!,
    title: getConditionTitle(condition),
    code: condition.code?.coding?.[0]?.code,
  }));

/**
 * The records the user's AI proposed from a document, as cards to accept,
 * skip or edit. Nothing is saved until every card is decided and the user
 * adds the accepted ones, together and linked.
 */
export function AIImportReviewView() {
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const review = useReview(activePatientId);
  const wide = useIsWideLayout();
  const [existing, setExisting] = useState<ExistingCondition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAllConditions(activePatientId)
      .then((conditions) => {
        if (!cancelled) setExisting(toExistingConditions(conditions));
      })
      .catch((err) => console.warn('Failed to load conditions:', err));
    return () => {
      cancelled = true;
    };
  }, [activePatientId]);

  if (!review)
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.column}>
          <ScreenHeading>Check what AI found</ScreenHeading>
          <Text style={styles.summary} testID="ai-import-review-empty">
            There is nothing to check. Use Import with AI on Home to add records
            from a document.
          </Text>
        </View>
        <ResourceActionDock showBack />
      </SafeAreaView>
    );

  const { accepted, undecided, total } = countDecisions(review);
  const [first, ...rest] = review.proposals;
  // Records from a visit are grouped under it when it leads the import.
  const grouped = first.kind === 'consultation' && rest.length > 0;

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const saved = await saveReview(review, activePatientId);
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

  const card = (proposal: Proposal) => (
    <ProposalCard
      key={proposal.ref}
      proposal={proposal}
      review={review}
      existing={existing}
      onEdit={() =>
        router.push({
          pathname: '/ai-import/edit',
          params: { ref: proposal.ref },
        })
      }
    />
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.column, wide && styles.wideColumn]}
        testID="ai-import-review"
      >
        <ScreenHeading>Check what AI found</ScreenHeading>
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
        {grouped ? (
          <>
            {card(first)}
            <Text style={styles.groupLabel} accessibilityRole="header">
              From this visit
            </Text>
            <View style={wide && styles.grid}>
              {rest.map((proposal) => (
                <View key={proposal.ref} style={wide && styles.gridItem}>
                  {card(proposal)}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={wide && styles.grid}>
            {review.proposals.map((proposal) => (
              <View key={proposal.ref} style={wide && styles.gridItem}>
                {card(proposal)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <ResourceActionDock
        showBack
        actions={[
          {
            label:
              undecided > 0
                ? `Accept or skip ${undecided} more ${undecided === 1 ? 'card' : 'cards'} to add records`
                : `Add ${accepted} ${accepted === 1 ? 'record' : 'records'}`,
            testID: 'ai-import-add-button',
            icon: Check,
            primary: true,
            disabled: undecided > 0 || accepted === 0,
            busy: isSaving,
            onPress: handleSave,
          },
        ]}
      />
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

function ProposalCard({
  proposal,
  review,
  existing,
  onEdit,
}: {
  proposal: Proposal;
  review: Review;
  existing: ExistingCondition[];
  onEdit: () => void;
}) {
  const decision = review.decisions[proposal.ref];
  const kind = PROPOSAL_KINDS[proposal.kind];
  const testID = `ai-import-card-${proposal.ref}`;
  const links = getProposalLinks(review, proposal);
  const dosing = getProposalDosing(proposal);
  const matches =
    proposal.kind === 'condition'
      ? findExistingConditions(proposal.input, existing)
      : [];
  const chosenExisting = review.existingConditions[proposal.ref] ?? '';

  return (
    <View
      style={[
        styles.card,
        decision === 'accepted' && styles.cardAccepted,
        decision === 'skipped' && styles.cardSkipped,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.content,
          decision === 'skipped' && styles.contentSkipped,
        ]}
      >
        <View style={styles.typeLine}>
          <IconDisc icon={kind.icon} size={32} />
          <Text style={styles.typeText}>{kind.label.toUpperCase()}</Text>
        </View>
        <Text style={styles.cardTitle} testID={`${testID}-title`}>
          {proposal.input.title}
        </Text>
        <ResourceMetaLine meta={getProposalMeta(proposal)} />
        {dosing.map((line) => (
          <Text key={line} style={styles.dosing}>
            {line}
          </Text>
        ))}
        {links.length > 0 && (
          <View style={styles.links} testID={`${testID}-links`}>
            {links.map((link) => {
              const Icon = link.dropped ? Unlink : Link2;
              return (
                <View
                  key={`${link.role}-${link.target.ref}`}
                  style={styles.linkRow}
                >
                  <Icon
                    size={14}
                    color={
                      link.dropped ? COLORS.light.muted : COLORS.light.primary
                    }
                  />
                  <Text
                    style={[
                      styles.linkText,
                      link.dropped && styles.linkDropped,
                    ]}
                  >
                    {linkText(proposal, link)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
        {matches.length > 0 && (
          <View style={styles.existing}>
            <Text style={styles.existingLabel}>Save as</Text>
            <NativeSelect
              testID={`${testID}-existing`}
              name={`existing-${proposal.ref}`}
              label="Save as"
              value={chosenExisting}
              options={[
                ...matches.map((match) => ({
                  id: match.id,
                  label: `Your condition: ${match.title}`,
                })),
                { id: '', label: 'New condition' },
              ]}
              onChange={(id) =>
                chooseExistingCondition(proposal.ref, id || null)
              }
            />
          </View>
        )}
        {proposal.source && (
          <View style={styles.sourceRow}>
            <Quote size={13} color={COLORS.light.muted} />
            <Text style={styles.sourceText}>From “{proposal.source}”</Text>
          </View>
        )}
      </View>
      <View style={styles.actions}>
        {decision === 'proposed' ? (
          <>
            <CardButton
              label="Skip"
              icon={X}
              testID={`${testID}-skip`}
              accessibilityLabel={`Skip ${proposal.input.title}`}
              onPress={() => decide(proposal.ref, 'skipped')}
            />
            <CardButton
              label="Edit"
              icon={Pencil}
              testID={`${testID}-edit`}
              accessibilityLabel={`Edit ${proposal.input.title}`}
              onPress={onEdit}
            />
            <CardButton
              label="Accept"
              icon={Check}
              primary
              testID={`${testID}-accept`}
              accessibilityLabel={`Accept ${proposal.input.title}`}
              onPress={() => decide(proposal.ref, 'accepted')}
            />
          </>
        ) : (
          <>
            <DecisionStatus decision={decision} testID={`${testID}-decision`} />
            <CardButton
              label="Undo"
              icon={Undo2}
              testID={`${testID}-undo`}
              accessibilityLabel={`Undo ${decision === 'accepted' ? 'accepting' : 'skipping'} ${proposal.input.title}`}
              onPress={() => decide(proposal.ref, 'proposed')}
            />
          </>
        )}
      </View>
    </View>
  );
}

function CardButton({
  label,
  icon: Icon,
  primary,
  testID,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  testID: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.button, primary && styles.buttonPrimary]}
    >
      <Icon
        size={16}
        color={
          primary ? COLORS.light.primaryForeground : COLORS.light.foreground
        }
      />
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** The card's decision as text: an icon and a word, never colour alone. */
function DecisionStatus({
  decision,
  testID,
}: {
  decision: Exclude<Decision, 'proposed'>;
  testID: string;
}) {
  const accepted = decision === 'accepted';
  const Icon = accepted ? Check : X;
  const color = accepted ? COLORS.light.primary : COLORS.light.mutedForeground;
  return (
    <View style={styles.status}>
      <Icon size={16} color={color} />
      <Text style={[styles.statusText, { color }]} testID={testID}>
        {accepted ? 'Accepted' : 'Skipped'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.light.background },
  scroll: { flex: 1 },
  column: { ...CONTENT_COLUMN, padding: 16, paddingBottom: 132 },
  wideColumn: { maxWidth: 1000 },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.mutedForeground,
    marginBottom: 16,
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
    marginBottom: 12,
  },
  groupLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.light.mutedForeground,
    marginTop: 8,
    marginBottom: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: { width: '48%', flexGrow: 1 },
  card: {
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  // Decisions also show as a badge with a word and an icon, not by colour alone.
  cardAccepted: {
    borderColor: COLORS.light.primary,
    borderWidth: 2,
    padding: 15,
  },
  cardSkipped: { borderStyle: 'dashed' },
  content: { gap: 8 },
  // Only the record fades; its Undo stays fully visible.
  contentSkipped: { opacity: 0.6 },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    color: COLORS.light.mutedForeground,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  dosing: { fontSize: 14, lineHeight: 20, color: COLORS.light.foreground },
  links: { gap: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  linkText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.primary,
  },
  linkDropped: { color: COLORS.light.mutedForeground },
  existing: { gap: 4 },
  existingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.mutedForeground,
  },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sourceText: {
    flex: 1,
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.light.mutedForeground,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
  },
  buttonPrimary: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
    marginLeft: 'auto',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  buttonTextPrimary: { color: COLORS.light.primaryForeground },
  // Grows to put Undo on the right, where Accept was.
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexGrow: 1 },
  statusText: { fontSize: 14, fontWeight: '600' },
});
