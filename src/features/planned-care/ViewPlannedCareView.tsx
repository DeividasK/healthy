import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FolderPlus, Stethoscope } from 'lucide-react-native';
import type { Condition, Encounter, ServiceRequest } from 'fhir/r5';
import { getPlannedCareMeta } from './PlannedCareRelatedRow';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import {
  deletePlannedCare,
  getConsultationIdsBasedOnPlannedCare,
  getConsultationIdsLinkingPlannedCare,
  getPlannedCareById,
  getPlannedCareOriginId,
} from './plannedCareService';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import {
  getPlannedCareInstructions,
  getPlannedCareNotes,
  getPlannedCareReason,
  getPlannedCareTitle,
  getReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

export function ViewPlannedCareView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ResourceViewLayout testID="planned-care-view" isLoading />;
  return (
    <PlannedCareForPatient
      key={`${activePatientId}:${id}`}
      id={id}
      activePatientId={activePatientId}
    />
  );
}

interface RelatedRecords {
  conditions: Condition[];
  origin: Encounter | null;
  linked: Encounter[];
  basedOn: Encounter[];
}

const NO_RELATED: RelatedRecords = {
  conditions: [],
  origin: null,
  linked: [],
  basedOn: [],
};

async function loadConsultations(ids: string[], patientId: string) {
  const consultations = await Promise.all(
    ids.map((id) => getConsultationById(id, patientId).catch(() => null))
  );
  return consultations.filter((c): c is Encounter => Boolean(c));
}

function PlannedCareForPatient({
  id,
  activePatientId,
}: {
  id: string;
  activePatientId: string;
}) {
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [related, setRelated] = useState<RelatedRecords>(NO_RELATED);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const loadSequence = useRef(0);

  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || !activePatientId) return;
    setHasLoadError(false);
    try {
      const loaded = await getPlannedCareById(id, activePatientId);
      if (sequence !== loadSequence.current) return;
      if (!loaded) {
        setNotFound(true);
        setRequest(null);
        setRelated(NO_RELATED);
        return;
      }
      const originId = getPlannedCareOriginId(loaded);
      const [conditions, origin, linkedIds, basedOnIds] = await Promise.all([
        Promise.all(
          getReasonConditionIds(loaded).map((conditionId) =>
            getConditionById(conditionId, activePatientId).catch(() => null)
          )
        ),
        originId
          ? getConsultationById(originId, activePatientId).catch(() => null)
          : null,
        getConsultationIdsLinkingPlannedCare(id, activePatientId),
        getConsultationIdsBasedOnPlannedCare(id, activePatientId),
      ]);
      const [linked, basedOn] = await Promise.all([
        loadConsultations(
          linkedIds.filter((cId) => cId !== originId),
          activePatientId
        ),
        loadConsultations(basedOnIds, activePatientId),
      ]);
      if (sequence !== loadSequence.current) return;
      setNotFound(false);
      setRequest(loaded);
      setRelated({
        conditions: conditions.filter((c): c is Condition => Boolean(c)),
        origin,
        linked,
        basedOn,
      });
    } catch (err) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load service request view data:', err);
      setHasLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    ['service_requests', 'consultations', 'clinical_documents', 'conditions'],
    loadData
  );

  if (
    isLoading ||
    (request && request.subject?.reference !== `Patient/${activePatientId}`)
  ) {
    return <ResourceViewLayout testID="planned-care-view" isLoading />;
  }

  if (hasLoadError || notFound || !request) {
    return (
      <ResourceViewLayout
        testID="planned-care-view"
        error={
          hasLoadError
            ? 'Failed to load service request.'
            : 'Service request not found.'
        }
      />
    );
  }

  const reason = getPlannedCareReason(request);
  const instructions = getPlannedCareInstructions(request);
  const notes = getPlannedCareNotes(request);
  const openConsultation = (consultation: Encounter) =>
    router.push(`/consultation/${consultation.id}`);

  return (
    <ResourceViewLayout
      testID="planned-care-view"
      title={getPlannedCareTitle(request)}
      titleTestID="planned-care-title"
      meta={getPlannedCareMeta(request, { withTestIDs: true })}
      actions={
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="planned-care-add-menu"
            options={[
              {
                id: 'consultation',
                label: 'Consultation',
                testID: 'menu-add-consultation',
                icon: (
                  <Stethoscope
                    color={COLORS.light.primary}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                ),
                onPress: () =>
                  router.push({
                    pathname: '/consultation/add',
                    params: { basedOnId: id },
                  }),
              },
            ]}
          />
          <ResourceActionDock
            editLabel="Edit service request"
            onEdit={() => {
              setShowAddMenu(false);
              router.push(`/planned-care/${id}/edit`);
            }}
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add record"
            addMenuExpanded={showAddMenu}
            editTestID="edit-planned-care-button"
            addTestID="planned-care-add-button"
            deleteLabel="Delete service request"
            deleteTestID="delete-planned-care-button"
            deleteConfirmation={{
              title: 'Delete Service Request',
              message:
                'Are you sure you want to delete this service request? This action cannot be undone.',
              onConfirm: async () => {
                await deletePlannedCare(id, activePatientId);
                goBackOr(router, '/');
              },
            }}
          />
        </>
      }
    >
      <View style={styles.details}>
        {Boolean(reason) && (
          <ResourceTextSection
            title="Reason"
            text={reason!}
            testID="planned-care-reason-section"
            textTestID="planned-care-reason"
          />
        )}
        {Boolean(instructions) && (
          <ResourceTextSection
            title="Instructions"
            text={instructions!}
            testID="planned-care-instructions-section"
            textTestID="planned-care-instructions"
          />
        )}
        {Boolean(notes) && (
          <ResourceTextSection
            title="Notes"
            text={notes!}
            testID="planned-care-notes-section"
            textTestID="planned-care-notes"
          />
        )}
      </View>

      <ResourceSection
        icon={FolderPlus}
        title="Associated Conditions"
        testID="planned-care-reason-conditions-section"
      >
        {related.conditions.map((condition) => (
          <ConditionRelatedRow
            key={condition.id}
            condition={condition}
            testID={`planned-care-condition-${condition.id}`}
            onPress={() => router.push(`/condition/${condition.id}`)}
          />
        ))}
      </ResourceSection>

      <ResourceSection
        icon={Stethoscope}
        title="Originating Consultation"
        testID="planned-care-origin-consultation"
      >
        {related.origin && (
          <ConsultationRelatedRow
            consultation={related.origin}
            testID="origin-consultation-link"
            onPress={() => openConsultation(related.origin!)}
          />
        )}
      </ResourceSection>

      <ResourceSection
        icon={Stethoscope}
        title="Linked Consultations"
        testID="planned-care-linked-consultations"
      >
        {related.linked.map((consultation) => (
          <ConsultationRelatedRow
            key={consultation.id}
            consultation={consultation}
            testID={`linked-consultation-${consultation.id}`}
            onPress={() => openConsultation(consultation)}
          />
        ))}
      </ResourceSection>

      <ResourceSection
        icon={Stethoscope}
        title="Visits Based on This"
        testID="planned-care-based-on-consultations"
      >
        {related.basedOn.map((consultation) => (
          <ConsultationRelatedRow
            key={consultation.id}
            consultation={consultation}
            testID={`based-on-consultation-${consultation.id}`}
            onPress={() => openConsultation(consultation)}
          />
        ))}
      </ResourceSection>
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 16,
    marginBottom: 28,
  },
});
