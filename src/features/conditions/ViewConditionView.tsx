import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ClipboardList,
  FlaskConical,
  Pill,
  Stethoscope,
} from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { BiomarkerResultRow } from '@/src/features/home/BiomarkerResultRow';
import { latestBiomarkers } from '@/src/features/home/LabsSummary';
import { sortSummaryBiomarkers } from '@/src/features/home/labsSummarySorting';
import { useRangeDemographics } from '@/src/features/lab-results/useRangeDemographics';
import type { DiagnosticReportRecord } from '@/src/database/types';
import { ConditionTimeline } from './ConditionTimeline';
import { buildTimelineItems } from './conditionTimeline';
import { getConditionMeta } from './ConditionRelatedRow';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationsByConditionId } from '@/src/features/consultations/consultationService';
import { getTreatmentsByConditionId } from '@/src/features/treatments/treatmentService';
import { getServiceRequestsByConditionId } from '@/src/features/service-requests/serviceRequestService';
import {
  getAllReports,
  getLabResultsByConditionId,
} from '@/src/features/lab-results/diagnosticReportService';
import { getConditionNotes, getConditionTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { deleteCondition, getConditionById } from './conditionService';
import { goBackOr } from '@/src/utils/navigation';
import { useIsWideLayout } from '@/src/theme/layout';
import type {
  Coding,
  Condition,
  DiagnosticReport,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';

export function ViewConditionView() {
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isWideWindow = useIsWideLayout();
  const [condition, setCondition] = useState<Condition | null>(null);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [treatments, setTreatments] = useState<MedicationRequest[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [labResults, setLabResults] = useState<DiagnosticReport[]>([]);
  const [reports, setReports] = useState<DiagnosticReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const loadSequence = useRef(0);
  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || isPatientLoading || !activePatientId) return;
    try {
      const [
        conditionData,
        consultationData,
        treatmentData,
        serviceRequestsData,
        labResultsData,
        reportsData,
      ] = await Promise.all([
        getConditionById(id, activePatientId),
        getConsultationsByConditionId(id),
        getTreatmentsByConditionId(id, activePatientId),
        getServiceRequestsByConditionId(id, activePatientId),
        getLabResultsByConditionId(id, activePatientId),
        getAllReports(activePatientId),
      ]);
      if (sequence !== loadSequence.current) return;
      setHasLoadError(false);
      if (!conditionData) {
        setNotFound(true);
        setCondition(null);
        setConsultations([]);
        setTreatments([]);
        setServiceRequests([]);
        setLabResults([]);
        setReports([]);
      } else {
        setNotFound(false);
        setCondition(conditionData);
        setConsultations(consultationData);
        setTreatments(treatmentData);
        setServiceRequests(serviceRequestsData);
        setLabResults(labResultsData);
        setReports(reportsData);
      }
    } catch (error) {
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load condition view data:', error);
      setHasLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [id, activePatientId, isPatientLoading]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    [
      'conditions',
      'consultations',
      'medication_requests',
      'service_requests',
      'diagnostic_reports',
      'observations',
    ],
    loadData
  );
  const demographics = useRangeDemographics();
  // The latest result of each biomarker in the condition's lab results,
  // largest deviation from the range first.
  const biomarkers = useMemo(() => {
    const linked = new Set(labResults.map((report) => report.id));
    return sortSummaryBiomarkers(
      latestBiomarkers(
        reports.filter(({ report }) => linked.has(report.id)),
        -Infinity,
        demographics
      ),
      'deviation',
      demographics
    );
  }, [labResults, reports, demographics]);

  if (
    isLoading ||
    isPatientLoading ||
    (condition && condition.subject.reference !== `Patient/${activePatientId}`)
  ) {
    return <ResourceViewLayout testID="condition-view" isLoading />;
  }

  if (hasLoadError || notFound || !condition) {
    return (
      <ResourceViewLayout
        testID="condition-view"
        error={
          hasLoadError ? 'Failed to load condition.' : 'Condition not found.'
        }
      />
    );
  }

  const title = getConditionTitle(condition);
  const notes = getConditionNotes(condition);

  const timelineItems = buildTimelineItems({
    consultations,
    serviceRequests,
    treatments,
    labResults,
  });
  // Desktop puts the timeline beside the details, when there is one.
  const isWide = isWideWindow && timelineItems.length > 0;
  const info = (
    <>
      {notes && (
        <View style={styles.details}>
          <ResourceTextSection
            title="Notes"
            text={notes}
            testID="condition-notes"
          />
        </View>
      )}
      {condition.code?.coding?.some((coding) => coding.code) && (
        <View style={styles.details}>
          <ResourceTextSection
            title="Diagnosis code"
            text={condition.code.coding
              .filter((coding) => coding.code)
              .map(formatTerminologyCoding)
              .join('\n')}
            testID="condition-terminology"
          />
        </View>
      )}

      <ResourceSection
        icon={FlaskConical}
        title="Biomarkers"
        count={biomarkers.length}
        testID="condition-biomarkers"
      >
        {biomarkers.length > 0 && (
          <CollapsibleList
            items={biomarkers}
            testID="condition-biomarkers-list"
            renderItem={({ id: key, observation }) => (
              <BiomarkerResultRow
                key={key}
                observation={observation}
                testID={`condition-biomarker-result-${key}`}
              />
            )}
          />
        )}
      </ResourceSection>
    </>
  );
  const timeline = <ConditionTimeline conditionId={id} items={timelineItems} />;

  return (
    <ResourceViewLayout
      testID="condition-view"
      wide={isWide}
      title={title}
      titleTestID="condition-title"
      meta={getConditionMeta(condition)}
      actions={
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="condition-add-menu"
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
                    params: { conditionId: id },
                  }),
              },
              {
                id: 'treatment',
                label: 'Treatment',
                testID: 'menu-add-treatment',
                icon: (
                  <Pill
                    color={COLORS.light.primary}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                ),
                onPress: () =>
                  router.push({
                    pathname: '/treatment/add',
                    params: { conditionId: id },
                  }),
              },
              {
                id: 'service-request',
                label: 'Service Request',
                testID: 'menu-add-service-request',
                icon: (
                  <ClipboardList
                    color={COLORS.light.primary}
                    size={18}
                    style={{ marginRight: 10 }}
                  />
                ),
                onPress: () =>
                  router.push({
                    pathname: '/service-request/add',
                    params: { conditionId: id },
                  }),
              },
            ]}
          />
          <ResourceActionDock
            editLabel="Edit condition"
            onEdit={() => {
              setShowAddMenu(false);
              router.push(`/condition/${id}/edit`);
            }}
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add record"
            addMenuExpanded={showAddMenu}
            editTestID="edit-condition-button"
            addTestID="condition-add-button"
            deleteLabel="Delete condition"
            deleteTestID="delete-condition-button"
            deleteConfirmation={{
              title: 'Delete Condition',
              message:
                'Are you sure you want to delete this condition? This action cannot be undone.',
              onConfirm: async () => {
                await deleteCondition(condition.id!);
                goBackOr(router, '/');
              },
            }}
          />
        </>
      }
    >
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.column}>{info}</View>
          <View style={styles.column}>{timeline}</View>
        </View>
      ) : (
        <>
          {info}
          {timeline}
        </>
      )}
    </ResourceViewLayout>
  );
}

const TERMINOLOGY_NAMES: Record<string, string> = {
  'http://snomed.info/sct': 'SNOMED CT',
  'http://hl7.org/fhir/sid/icd-10': 'ICD-10',
  'http://hl7.org/fhir/sid/icd-10-cm': 'ICD-10-CM',
};

/** One diagnosis code, e.g. "Hypercholesterolemia (SNOMED CT 13644009)". */
function formatTerminologyCoding(coding: Coding): string {
  const system = coding.system
    ? (TERMINOLOGY_NAMES[coding.system] ?? coding.system)
    : '';
  const code = [system, coding.code].filter(Boolean).join(' ');
  return coding.display ? `${coding.display} (${code})` : code;
}

const styles = StyleSheet.create({
  details: {
    marginBottom: 26,
    gap: 10,
  },
  columns: { flexDirection: 'row', gap: 48, alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
});
