import React, { useCallback, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react-native';
import type { MedicationRequest, Encounter, Condition } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useSync } from '@/src/context/SyncContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { fetchConsultationIdsReferencingResource } from '@/src/features/consultations/clinicalDocumentsRepository';
import { getTreatmentById, deleteTreatment } from './treatmentService';
import {
  getTreatmentIntentLabel,
  getTreatmentStatusLabel,
} from './treatmentLabels';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import {
  getTreatmentTitle,
  getTreatmentInstructions,
  getTreatmentNotes,
  getTreatmentReason,
  getTreatmentReasonConditionId,
  getConsultationTitle,
  getConditionTitle,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';

export function ViewTreatmentView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ResourceViewLayout testID="treatment-view" isLoading />;
  return (
    <TreatmentForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

function TreatmentForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const { triggerSync } = useSync();

  const [treatment, setTreatment] = useState<MedicationRequest | null>(null);
  const [originConsultation, setOriginConsultation] =
    useState<Encounter | null>(null);
  const [reasonCondition, setReasonCondition] = useState<Condition | null>(
    null
  );
  const [linkedConsultations, setLinkedConsultations] = useState<Encounter[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || !activePatientId) return;

    setHasLoadError(false);
    try {
      const treat = await getTreatmentById(id, activePatientId);
      if (sequence !== loadSequence.current) return;

      if (!treat) {
        setNotFound(true);
        setTreatment(null);
        setOriginConsultation(null);
        setReasonCondition(null);
        setLinkedConsultations([]);
        return;
      }

      setNotFound(false);
      setTreatment(treat);

      // Load originating consultation if any
      const encounterRef = treat.encounter?.reference;
      let origin: Encounter | null = null;
      if (encounterRef?.startsWith('Encounter/')) {
        const consId = encounterRef.slice(10);
        origin = await getConsultationById(consId, activePatientId).catch(
          () => null
        );
      }
      if (sequence !== loadSequence.current) return;
      setOriginConsultation(origin);

      // Load reason condition if any
      const reasonCondId = getTreatmentReasonConditionId(treat);
      let condition: Condition | null = null;
      if (reasonCondId) {
        condition = await getConditionById(reasonCondId, activePatientId).catch(
          () => null
        );
      }
      if (sequence !== loadSequence.current) return;
      setReasonCondition(condition);

      // Load other consultations whose documents link this treatment
      const otherConsIds = (
        await fetchConsultationIdsReferencingResource(
          `MedicationRequest/${id}`,
          activePatientId
        )
      ).filter((cId) => Boolean(cId) && cId !== origin?.id);

      const loadedOthers: Encounter[] = [];
      for (const cId of otherConsIds) {
        const cons = await getConsultationById(cId, activePatientId).catch(
          () => null
        );
        if (cons) loadedOthers.push(cons);
      }

      if (sequence !== loadSequence.current) return;
      setLinkedConsultations(loadedOthers);
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load treatment view data:', err);
      setHasLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    [
      'medication_requests',
      'consultations',
      'clinical_documents',
      'conditions',
    ],
    loadData
  );

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteTreatment(id, activePatientId);
      setShowDeleteModal(false);
      triggerSync().catch((err) =>
        console.warn('Background sync failed on delete treatment:', err)
      );
      router.dismissTo('/');
    } catch (err) {
      console.error('Failed to delete treatment:', err);
      const message = 'Failed to delete. Please try again.';
      if (Platform.OS === 'web' && typeof window !== 'undefined')
        window.alert(message);
      else Alert.alert('Error', message);
    }
  };

  if (
    isLoading ||
    (treatment && treatment.subject?.reference !== `Patient/${activePatientId}`)
  ) {
    return <ResourceViewLayout testID="treatment-view" isLoading />;
  }

  if (hasLoadError || notFound || !treatment) {
    return (
      <ResourceViewLayout
        testID="treatment-view"
        error={
          hasLoadError ? 'Failed to load treatment.' : 'Treatment not found.'
        }
      />
    );
  }

  const title = getTreatmentTitle(treatment);
  const instructions = getTreatmentInstructions(treatment);
  const notes = getTreatmentNotes(treatment);
  const reasonText = getTreatmentReason(treatment);
  const statusStr = getTreatmentStatusLabel(treatment.status);
  const intentStr = getTreatmentIntentLabel(treatment.intent);
  const authoredDate = treatment.authoredOn;

  return (
    <>
      <ResourceViewLayout
        testID="treatment-view"
        title={title}
        titleTestID="treatment-title"
        date={
          authoredDate
            ? authoredDate.includes('T')
              ? formatDisplayDateTime(authoredDate)
              : formatDisplayDate(authoredDate)
            : undefined
        }
        status={{ label: statusStr }}
        actions={
          <ResourceActionDock
            actions={[
              {
                label: 'Delete treatment',
                testID: 'delete-treatment-button',
                icon: Trash2,
                onPress: () => setShowDeleteModal(true),
              },
              {
                label: 'Edit treatment',
                testID: 'edit-treatment-button',
                icon: Pencil,
                onPress: () => router.push(`/treatment/${id}/edit`),
                primary: true,
              },
            ]}
          />
        }
      >
        <View style={styles.details}>
          <InfoRow label="Intent" value={intentStr} testID="treatment-intent" />
          {Boolean(reasonText) && (
            <InfoRow
              label="Reason"
              value={reasonText!}
              testID="treatment-reason-section"
            />
          )}
          {reasonCondition && (
            <View
              style={styles.infoRow}
              testID="treatment-reason-condition-section"
            >
              <Text style={styles.infoLabel}>Reason Condition</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`View condition: ${getConditionTitle(reasonCondition)}`}
                onPress={() =>
                  router.dismissTo(`/condition/${reasonCondition.id}`)
                }
              >
                <Text style={[styles.infoValue, styles.linkText]}>
                  {getConditionTitle(reasonCondition)}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {Boolean(instructions) && (
            <View
              style={styles.sectionContainer}
              testID="treatment-instructions-section"
            >
              <Text style={styles.sectionTitle}>Dosage Instructions</Text>
              <Text
                style={styles.instructionsText}
                testID="treatment-instructions"
              >
                {instructions}
              </Text>
            </View>
          )}

          {Boolean(notes) && (
            <View
              style={styles.sectionContainer}
              testID="treatment-notes-section"
            >
              <Text style={styles.sectionTitle}>Notes</Text>
              <Text style={styles.notesText} testID="treatment-notes">
                {notes}
              </Text>
            </View>
          )}

          {Boolean(originConsultation) && (
            <View
              style={styles.sectionContainer}
              testID="treatment-origin-consultation"
            >
              <Text style={styles.sectionTitle}>Originating Consultation</Text>
              <TouchableOpacity
                style={styles.consultationCard}
                testID="origin-consultation-link"
                accessibilityRole="button"
                accessibilityLabel={`View consultation: ${getConsultationTitle(originConsultation!)}`}
                onPress={() =>
                  router.dismissTo(`/consultation/${originConsultation!.id}`)
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.consultationCardTitle}>
                    {getConsultationTitle(originConsultation!)}
                  </Text>
                  {Boolean(originConsultation!.actualPeriod?.start) && (
                    <Text style={styles.consultationCardDate}>
                      {formatDisplayDate(
                        originConsultation!.actualPeriod!.start!
                      )}
                    </Text>
                  )}
                </View>
                <ChevronRight color={COLORS.light.muted} size={18} />
              </TouchableOpacity>
            </View>
          )}

          {linkedConsultations.length > 0 && (
            <View
              style={styles.sectionContainer}
              testID="treatment-linked-consultations"
            >
              <Text style={styles.sectionTitle}>Linked Consultations</Text>
              {linkedConsultations.map((cons) => (
                <TouchableOpacity
                  key={cons.id}
                  style={styles.consultationCard}
                  testID={`linked-consultation-${cons.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View consultation: ${getConsultationTitle(cons)}`}
                  onPress={() => router.dismissTo(`/consultation/${cons.id}`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.consultationCardTitle}>
                      {getConsultationTitle(cons)}
                    </Text>
                    {Boolean(cons.actualPeriod?.start) && (
                      <Text style={styles.consultationCardDate}>
                        {formatDisplayDate(cons.actualPeriod!.start!)}
                      </Text>
                    )}
                  </View>
                  <ChevronRight color={COLORS.light.muted} size={18} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ResourceViewLayout>

      <DeleteConfirmationModal
        visible={showDeleteModal}
        title="Delete Treatment"
        message="Are you sure you want to delete this treatment? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
        testID="delete-treatment-modal"
      />
    </>
  );
}

function InfoRow({
  label,
  value,
  testID,
}: {
  label: string;
  value: string;
  testID?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 16,
    marginBottom: 28,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 20,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.light.mutedForeground,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    textAlign: 'right',
  },
  linkText: {
    color: COLORS.light.primary,
  },
  sectionContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.foreground,
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    padding: 12,
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.light.textSecondary,
  },
  consultationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    marginBottom: 8,
  },
  consultationCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  consultationCardDate: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
    marginTop: 2,
  },
});
