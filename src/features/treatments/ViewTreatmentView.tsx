import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, Alert, Platform } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FolderPlus, Group, Pencil, Stethoscope } from 'lucide-react-native';
import type {
  MedicationRequest,
  Encounter,
  Condition,
  RequestOrchestration,
} from 'fhir/r5';
import { BundleRelatedRow } from '@/src/features/bundles/BundleRelatedRow';
import { getBundlesWithTreatment } from '@/src/features/bundles/bundleService';
import { getTreatmentMeta } from './TreatmentRelatedRow';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { fetchConsultationIdsReferencingResource } from '@/src/features/consultations/clinicalDocumentsRepository';
import { getTreatmentById, deleteTreatment } from './treatmentService';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import {
  getTreatmentTitle,
  getTreatmentNotes,
  getTreatmentReason,
  getTreatmentReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { formatDosingLines, formatQuantityText } from './regimen';
import { TreatmentLogHistory } from '@/src/features/actions/TreatmentLogHistory';
import {
  TreatmentUsageSection,
  useTreatmentUsage,
} from '@/src/features/actions/TreatmentUsageSection';

export function ViewTreatmentView({
  id: selectedId,
  onDeleted,
}: {
  /** Shown beside the treatments list on desktop instead of the route's. */
  id?: string;
  /** Beside the list, deleting stays on it instead of returning home. */
  onDeleted?: () => void;
} = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const id = selectedId ?? params.id;
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ResourceViewLayout testID="treatment-view" isLoading />;
  return (
    <TreatmentForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
      onDeleted={onDeleted}
    />
  );
}

function TreatmentForPatient({
  id,
  activePatientId,
  onDeleted,
}: {
  id: string;
  activePatientId: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();

  const [treatment, setTreatment] = useState<MedicationRequest | null>(null);
  const [originConsultation, setOriginConsultation] =
    useState<Encounter | null>(null);
  const [reasonConditions, setReasonConditions] = useState<Condition[]>([]);
  const [linkedConsultations, setLinkedConsultations] = useState<Encounter[]>(
    []
  );
  const [bundles, setBundles] = useState<RequestOrchestration[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const usage = useTreatmentUsage(id, activePatientId);

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
        setReasonConditions([]);
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

      // Load every associated condition that still exists
      const conditions = await Promise.all(
        getTreatmentReasonConditionIds(treat).map((conditionId) =>
          getConditionById(conditionId, activePatientId).catch(() => null)
        )
      );
      if (sequence !== loadSequence.current) return;
      setReasonConditions(
        conditions.filter((condition): condition is Condition =>
          Boolean(condition)
        )
      );

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

      const treatmentBundles = await getBundlesWithTreatment(
        id,
        activePatientId
      );
      if (sequence !== loadSequence.current) return;
      setLinkedConsultations(loadedOthers);
      setBundles(treatmentBundles);
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
      'request_orchestrations',
    ],
    loadData
  );

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteTreatment(id, activePatientId);
      setShowDeleteModal(false);
      if (onDeleted) onDeleted();
      else router.dismissTo('/');
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
  const notes = getTreatmentNotes(treatment);
  const reasonText = getTreatmentReason(treatment);
  // What was prescribed, and the regimen of the current period of taking it
  // when that differs from the prescription.
  const dosage = formatDosingLines(treatment.dosageInstruction).join('\n');
  const takenRegimen = formatDosingLines(
    usage.isTaking ? usage.periods[usage.periods.length - 1]?.dosage : []
  ).join('\n');
  const currentRegimen = takenRegimen === dosage ? '' : takenRegimen;
  const dispenseQuantity = formatQuantityText(
    treatment.dispenseRequest?.quantity
  );

  return (
    <>
      <ResourceViewLayout
        testID="treatment-view"
        title={title}
        titleTestID="treatment-title"
        meta={getTreatmentMeta(treatment, { withTestIDs: true })}
        actions={
          <ResourceActionDock
            actions={[
              // Play to start or resume taking it; change usage while taking it.
              { ...usage.primaryAction, primary: true },
              {
                label: 'Edit treatment',
                testID: 'edit-treatment-button',
                icon: Pencil,
                onPress: () => router.push(`/treatment/${id}/edit`),
              },
            ]}
            onDelete={() => setShowDeleteModal(true)}
            deleteLabel="Delete treatment"
            deleteTestID="delete-treatment-button"
          />
        }
      >
        <View style={styles.details}>
          {Boolean(reasonText) && (
            <InfoRow
              label="Reason"
              value={reasonText!}
              testID="treatment-reason-section"
            />
          )}
          {Boolean(dosage) && (
            <ResourceTextSection
              title="Prescribed Dosage"
              text={dosage}
              testID="treatment-dosage-section"
              textTestID="treatment-dosage"
            />
          )}
          {Boolean(currentRegimen) && (
            <ResourceTextSection
              title="Current Regimen"
              text={currentRegimen}
              testID="treatment-current-regimen-section"
              textTestID="treatment-current-regimen"
            />
          )}
          {Boolean(dispenseQuantity) && (
            <InfoRow
              label="Quantity to Dispense"
              value={dispenseQuantity!}
              testID="treatment-dispense-quantity"
            />
          )}
          {Boolean(notes) && (
            <ResourceTextSection
              title="Notes"
              text={notes!}
              testID="treatment-notes-section"
              textTestID="treatment-notes"
            />
          )}
        </View>

        {reasonConditions.length > 0 && (
          <ResourceSection
            icon={FolderPlus}
            title="Associated Conditions"
            count={reasonConditions.length}
            testID="treatment-reason-conditions-section"
          >
            {reasonConditions.map((condition) => (
              <ConditionRelatedRow
                key={condition.id}
                condition={condition}
                testID={`treatment-condition-${condition.id}`}
                onPress={() => router.push(`/condition/${condition.id}`)}
              />
            ))}
          </ResourceSection>
        )}

        <TreatmentUsageSection
          periods={usage.periods}
          onEdit={usage.editPeriod}
        />

        <TreatmentLogHistory
          treatmentId={id}
          patientId={activePatientId}
          isActive={treatment.status === 'active'}
        />

        <ResourceSection
          icon={Group}
          title="Bundles"
          count={bundles.length}
          testID="treatment-bundles-section"
        >
          {bundles.map((bundle) => (
            <BundleRelatedRow
              key={bundle.id}
              bundle={bundle}
              testID={`treatment-bundle-${bundle.id}`}
              onPress={() => router.push(`/bundle/${bundle.id}`)}
            />
          ))}
        </ResourceSection>

        {originConsultation && (
          <ResourceSection
            icon={Stethoscope}
            title="Originating Consultation"
            count={1}
            testID="treatment-origin-consultation"
          >
            <ConsultationRelatedRow
              consultation={originConsultation}
              testID="origin-consultation-link"
              onPress={() =>
                router.push(`/consultation/${originConsultation.id}`)
              }
            />
          </ResourceSection>
        )}

        {linkedConsultations.length > 0 && (
          <ResourceSection
            icon={Stethoscope}
            title="Linked Consultations"
            count={linkedConsultations.length}
            testID="treatment-linked-consultations"
          >
            {linkedConsultations.map((consultation) => (
              <ConsultationRelatedRow
                key={consultation.id}
                consultation={consultation}
                testID={`linked-consultation-${consultation.id}`}
                onPress={() => router.push(`/consultation/${consultation.id}`)}
              />
            ))}
          </ResourceSection>
        )}
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
});
