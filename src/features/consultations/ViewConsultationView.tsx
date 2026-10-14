import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FolderPlus, Hash, Plus } from 'lucide-react-native';
import type { Condition, Encounter, MedicationRequest } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceRow, ResourceSection } from '@/src/components/ResourceSection';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import { getLinkedTreatmentsForConsultation } from '@/src/features/treatments/treatmentService';
import { RelatedResourceList } from './RelatedResourceList';
import { getConsultationMeta } from './ConsultationRelatedRow';
import {
  getConditionTitle,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getConsultationNotes,
  getConsultationTitle,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';

export function ViewConsultationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const loadGeneration = useRef(0);
  const [consultation, setConsultation] = useState<Encounter | null>(null);
  const [relatedConditions, setRelatedConditions] = useState<Condition[]>([]);
  const [linkedTreatments, setLinkedTreatments] = useState<MedicationRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const loadData = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!id || !activePatientId) return;
    try {
      const [value, treatments] = await Promise.all([
        getConsultationById(id, activePatientId),
        getLinkedTreatmentsForConsultation(id, activePatientId).catch(() => []),
      ]);
      if (generation !== loadGeneration.current) return;
      if (!value) {
        setConsultation(null);
        setRelatedConditions([]);
        setLinkedTreatments([]);
        setNotFound(true);
        setHasLoadError(false);
        return;
      }
      const conditions = await Promise.all(
        [
          ...new Set([
            ...getConsultationConditionIds(value),
            ...getConsultationReasonConditionIds(value),
          ]),
        ].map((conditionId) =>
          getConditionById(conditionId).catch((error) => {
            console.warn('Failed to load related condition:', error);
            return null;
          })
        )
      );
      if (generation !== loadGeneration.current) return;
      setConsultation(value);
      setRelatedConditions(
        conditions.filter((condition): condition is Condition =>
          Boolean(condition)
        )
      );
      setLinkedTreatments(treatments);
      setNotFound(false);
      setHasLoadError(false);
    } catch (error) {
      console.error('Failed to load consultation view data:', error);
      if (generation === loadGeneration.current) setHasLoadError(true);
    } finally {
      if (generation === loadGeneration.current) setIsLoading(false);
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    [
      'consultations',
      'conditions',
      'medication_requests',
      'clinical_documents',
    ],
    loadData
  );

  if (isLoading) {
    return <ResourceViewLayout testID="consultation-view" isLoading />;
  }

  if (
    hasLoadError ||
    notFound ||
    !consultation ||
    consultation.subject?.reference !== `Patient/${activePatientId}`
  ) {
    return (
      <ResourceViewLayout
        testID="consultation-view"
        error={
          hasLoadError
            ? 'Failed to load consultation.'
            : 'Consultation not found.'
        }
      />
    );
  }

  const title = getConsultationTitle(consultation);
  const notes = getConsultationNotes(consultation);

  return (
    <ResourceViewLayout
      testID="consultation-view"
      title={title}
      titleTestID="consultation-title"
      meta={getConsultationMeta(consultation, { withTestIDs: true })}
      actions={
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="consultation-add-menu"
            options={[
              {
                id: 'create-treatment',
                label: 'Create New Treatment',
                testID: 'option-create-new-treatment',
                icon: (
                  <Plus
                    color={COLORS.light.primary}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                ),
                onPress: () =>
                  router.push({
                    pathname: '/treatment/add',
                    params: { consultationId: id },
                  }),
              },
            ]}
          />
          <ResourceActionDock
            editLabel="Edit consultation"
            onEdit={() => {
              setShowAddMenu(false);
              router.push(`/consultation/${id}/edit`);
            }}
            editTestID="edit-consultation-button"
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add treatment"
            addMenuExpanded={showAddMenu}
            addTestID="consultation-add-treatment"
          />
        </>
      }
    >
      {notes && (
        <View style={styles.details}>
          <ResourceTextSection
            title="Notes"
            text={notes}
            testID="consultation-notes"
          />
        </View>
      )}

      {getConsultationReasonConditionIds(consultation).length > 0 && (
        <ResourceSection
          icon={FolderPlus}
          title="Reasons for visit"
          testID="consultation-reasons"
        >
          {relatedConditions
            .filter((condition) =>
              getConsultationReasonConditionIds(consultation).includes(
                condition.id!
              )
            )
            .map((condition, index) => (
              <ConditionRelatedRow
                key={condition.id}
                condition={condition}
                testID={
                  index === 0
                    ? 'consultation-related-condition'
                    : `consultation-related-condition-${condition.id}`
                }
                onPress={() => router.push(`/condition/${condition.id}`)}
              />
            ))}
        </ResourceSection>
      )}
      {Boolean(consultation.diagnosis?.length) && (
        <ResourceSection
          icon={FolderPlus}
          title="Diagnoses"
          testID="consultation-diagnoses"
        >
          {consultation.diagnosis?.flatMap((diagnosis, index) =>
            (diagnosis.condition || []).map((value, valueIndex) => {
              const id = value.reference?.reference?.startsWith('Condition/')
                ? value.reference.reference.slice(10)
                : undefined;
              const condition = relatedConditions.find(
                (item) => item.id === id
              );
              const label =
                value.concept?.text ||
                value.concept?.coding?.[0]?.display ||
                (condition
                  ? getConditionTitle(condition)
                  : value.reference?.display);
              if (!label) return null;
              return (
                <ResourceRow
                  key={`${index}-${valueIndex}`}
                  title={label}
                  meta={(value.concept?.coding || []).map((coding) => ({
                    icon: Hash,
                    text: [coding.system, coding.code, coding.display]
                      .filter(Boolean)
                      .join(' · '),
                  }))}
                  {...(condition
                    ? {
                        testID:
                          index === 0
                            ? 'consultation-diagnosis-condition'
                            : `consultation-diagnosis-condition-${id}`,
                        accessibilityLabel: `View condition: ${getConditionTitle(condition)}`,
                        onPress: () => router.push(`/condition/${id}`),
                      }
                    : { testID: `consultation-diagnosis-${index}` })}
                />
              );
            })
          )}
        </ResourceSection>
      )}

      <RelatedResourceList linkedTreatments={linkedTreatments} />
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 12,
    marginBottom: 28,
  },
});
