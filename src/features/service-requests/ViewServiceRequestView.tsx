import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FlaskConical, FolderPlus, Stethoscope } from 'lucide-react-native';
import type {
  Condition,
  DiagnosticReport,
  Encounter,
  ServiceRequest,
} from 'fhir/r5';
import { getServiceRequestMeta } from './ServiceRequestRelatedRow';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { LabResultRelatedRow } from '@/src/features/lab-results/LabResultRelatedRow';
import { getLabResultsByServiceRequestId } from '@/src/features/lab-results/diagnosticReportService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import {
  deleteServiceRequest,
  getConsultationIdsBasedOnServiceRequest,
  getConsultationIdsLinkingServiceRequest,
  getServiceRequestById,
  getServiceRequestOriginId,
} from './serviceRequestService';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import {
  getServiceRequestInstructions,
  getServiceRequestNotes,
  getServiceRequestReason,
  getServiceRequestTitle,
  getReasonConditionIds,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

export function ViewServiceRequestView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activePatientId, isLoading } = useActivePatient();
  if (isLoading)
    return <ResourceViewLayout testID="service-request-view" isLoading />;
  return (
    <ServiceRequestForPatient
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
  labResults: DiagnosticReport[];
}

const NO_RELATED: RelatedRecords = {
  conditions: [],
  origin: null,
  linked: [],
  basedOn: [],
  labResults: [],
};

async function loadConsultations(ids: string[], patientId: string) {
  const consultations = await Promise.all(
    ids.map((id) => getConsultationById(id, patientId).catch(() => null))
  );
  return consultations.filter((c): c is Encounter => Boolean(c));
}

function ServiceRequestForPatient({
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
      const loaded = await getServiceRequestById(id, activePatientId);
      if (sequence !== loadSequence.current) return;
      if (!loaded) {
        setNotFound(true);
        setRequest(null);
        setRelated(NO_RELATED);
        return;
      }
      const originId = getServiceRequestOriginId(loaded);
      const [conditions, origin, linkedIds, basedOnIds, labResults] =
        await Promise.all([
          Promise.all(
            getReasonConditionIds(loaded).map((conditionId) =>
              getConditionById(conditionId, activePatientId).catch(() => null)
            )
          ),
          originId
            ? getConsultationById(originId, activePatientId).catch(() => null)
            : null,
          getConsultationIdsLinkingServiceRequest(id, activePatientId),
          getConsultationIdsBasedOnServiceRequest(id, activePatientId),
          getLabResultsByServiceRequestId(id, activePatientId),
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
        labResults,
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
    [
      'service_requests',
      'consultations',
      'clinical_documents',
      'conditions',
      'diagnostic_reports',
    ],
    loadData
  );

  if (
    isLoading ||
    (request && request.subject?.reference !== `Patient/${activePatientId}`)
  ) {
    return <ResourceViewLayout testID="service-request-view" isLoading />;
  }

  if (hasLoadError || notFound || !request) {
    return (
      <ResourceViewLayout
        testID="service-request-view"
        error={
          hasLoadError
            ? 'Failed to load service request.'
            : 'Service request not found.'
        }
      />
    );
  }

  const reason = getServiceRequestReason(request);
  const instructions = getServiceRequestInstructions(request);
  const notes = getServiceRequestNotes(request);
  const openConsultation = (consultation: Encounter) =>
    router.push(`/consultation/${consultation.id}`);

  return (
    <ResourceViewLayout
      testID="service-request-view"
      title={getServiceRequestTitle(request)}
      titleTestID="service-request-title"
      meta={getServiceRequestMeta(request, { withTestIDs: true })}
      actions={
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="service-request-add-menu"
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
              router.push(`/service-request/${id}/edit`);
            }}
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add record"
            addMenuExpanded={showAddMenu}
            editTestID="edit-service-request-button"
            addTestID="service-request-add-button"
            deleteLabel="Delete service request"
            deleteTestID="delete-service-request-button"
            deleteConfirmation={{
              title: 'Delete Service Request',
              message:
                'Are you sure you want to delete this service request? This action cannot be undone.',
              onConfirm: async () => {
                await deleteServiceRequest(id, activePatientId);
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
            testID="service-request-reason-section"
            textTestID="service-request-reason"
          />
        )}
        {Boolean(instructions) && (
          <ResourceTextSection
            title="Instructions"
            text={instructions!}
            testID="service-request-instructions-section"
            textTestID="service-request-instructions"
          />
        )}
        {Boolean(notes) && (
          <ResourceTextSection
            title="Notes"
            text={notes!}
            testID="service-request-notes-section"
            textTestID="service-request-notes"
          />
        )}
      </View>

      <ResourceSection
        icon={FolderPlus}
        title="Associated Conditions"
        count={related.conditions.length}
        testID="service-request-reason-conditions-section"
      >
        {related.conditions.map((condition) => (
          <ConditionRelatedRow
            key={condition.id}
            condition={condition}
            testID={`service-request-condition-${condition.id}`}
            onPress={() => router.push(`/condition/${condition.id}`)}
          />
        ))}
      </ResourceSection>

      <ResourceSection
        icon={Stethoscope}
        title="Originating Consultation"
        count={related.origin ? 1 : 0}
        testID="service-request-origin-consultation"
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
        count={related.linked.length}
        testID="service-request-linked-consultations"
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
        count={related.basedOn.length}
        testID="service-request-based-on-consultations"
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

      <ResourceSection
        icon={FlaskConical}
        title="Lab results"
        count={related.labResults.length}
        testID="service-request-lab-results-section"
      >
        {related.labResults.map((report) => (
          <LabResultRelatedRow
            key={report.id}
            report={report}
            testID={`service-request-lab-result-${report.id}`}
            onPress={() => router.push(`/lab-result/${report.id}`)}
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
