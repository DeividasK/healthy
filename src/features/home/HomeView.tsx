import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import {
  ClipboardList,
  FileText,
  FolderPlus,
  ListChecks,
  Pill,
  Plus,
  Sparkles,
  Stethoscope,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiagnosticReportRecord } from '@/src/database/types';
import { getAllReports } from '@/src/features/lab-results/diagnosticReportService';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { getAllConsultations } from '@/src/features/consultations/consultationService';
import { getAllTreatments } from '@/src/features/treatments/treatmentService';
import { getAllServiceRequests } from '@/src/features/service-requests/serviceRequestService';
import { countConsultationsReferencingResources } from '@/src/features/consultations/clinicalDocumentsRepository';
import { ServiceRequestRelatedRow } from '@/src/features/service-requests/ServiceRequestRelatedRow';
import { CollapsibleList } from '@/src/components/CollapsibleList';
import { ActionWeekStrip } from '@/src/features/actions/ActionWeekStrip';
import { getActionDays } from '@/src/features/actions/treatmentLogService';
import {
  daysEndingOn,
  todayKey,
  type ActionDay,
} from '@/src/features/actions/actionDays';
import {
  ResourceSection,
  type ResourceMeta,
} from '@/src/components/ResourceSection';
import { ConditionRelatedRow } from '@/src/features/conditions/ConditionRelatedRow';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { TreatmentRelatedRow } from '@/src/features/treatments/TreatmentRelatedRow';
import type { LucideIcon } from 'lucide-react-native';

import type {
  Condition,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';
import {
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getTreatmentReasonConditionIds,
  getReasonConditionIds,
} from '@/src/utils/fhirUtils';

import { COLORS } from '@/src/theme/colors';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { AIImportModal } from '@/src/components/AIImportModal';
import {
  buildAIImportInstructions,
  parseAIImportReply,
} from '@/src/features/ai-import/aiImportFormat';
import { startReview } from '@/src/features/ai-import/proposals';
import { setReview } from '@/src/features/ai-import/reviewStore';
import { toExistingConditions } from '@/src/features/ai-import/AIImportReviewView';
import { ResourceSkeleton } from '@/src/components/ResourceSkeleton';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllPatients } from '@/src/features/profile/patientService';
import {
  subscribeToDatabaseChanges,
  useDatabaseSubscription,
} from '@/src/database/dbEvents';
import { LabsSummary } from './LabsSummary';
import {
  DEFAULT_LABS_SUMMARY_FILTERS,
  parseLabsSummaryFilters,
} from './labsSummaryFilters';
import { useSavedFilters } from '@/src/utils/savedFilters';
import { StartYourRecord } from './StartYourRecord';
import {
  CONTENT_COLUMN,
  WIDE_MAX_WIDTH,
  useIsWideLayout,
} from '@/src/theme/layout';

const blurActiveElement = () => {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    (document.activeElement as HTMLElement)?.blur?.();
  }
};

/** Rows only show counts for associated resource types they actually have. */
const withoutZeroCounts = (counts: (ResourceMeta & { count: number })[]) =>
  counts.filter(({ count }) => count > 0);

/** Meta item showing how many associated resources of one type a row has. */
const countMeta = (
  icon: LucideIcon,
  count: number,
  label: string,
  testID: string
): ResourceMeta & { count: number } => ({
  count,
  icon,
  text: String(count),
  accessibilityLabel: `${count} ${label}`,
  testID,
});

interface HomeData {
  records: DiagnosticReportRecord[];
  conditions: Condition[];
  consultations: Encounter[];
  treatments: MedicationRequest[];
  consultationTreatmentCounts: Record<string, number>;
  serviceRequests: ServiceRequest[];
  consultationServiceRequestCounts: Record<string, number>;
  actionDays: ActionDay[];
}

const EMPTY_HOME_DATA: HomeData = {
  records: [],
  conditions: [],
  consultations: [],
  treatments: [],
  consultationTreatmentCounts: {},
  serviceRequests: [],
  consultationServiceRequestCounts: {},
  actionDays: [],
};

/**
 * The last Home data loaded for each profile, kept in memory only. Returning
 * to Home or switching back to a profile shows it at once while it refreshes.
 */
const homeDataCache = new Map<string, HomeData>();
// Profiles created, deleted, restored or reset make every entry suspect.
subscribeToDatabaseChanges((tables) => {
  if (tables.includes('patients')) homeDataCache.clear();
});

/** Counts the given resources' links per consultation; a failure only loses the counts. */
const countConsultationLinks = (
  resourceType: string,
  items: { id?: string }[],
  patientId: string
) =>
  countConsultationsReferencingResources(
    items.flatMap((item) => (item.id ? [`${resourceType}/${item.id}`] : [])),
    patientId
  ).catch((error) => {
    console.warn('Failed to load consultation links:', error);
    return {} as Record<string, number>;
  });

/** Loads everything Home shows for one profile. */
async function fetchHomeData(patientId: string): Promise<HomeData> {
  const [
    records,
    conditions,
    consultations,
    treatments,
    serviceRequests,
    actionDays,
  ] = await Promise.all([
    getAllReports(patientId),
    getAllConditions(patientId),
    getAllConsultations(patientId),
    getAllTreatments(patientId),
    getAllServiceRequests(patientId),
    getActionDays(patientId, daysEndingOn(todayKey())),
  ]);
  const [consultationTreatmentCounts, consultationServiceRequestCounts] =
    await Promise.all([
      countConsultationLinks('MedicationRequest', treatments, patientId),
      countConsultationLinks('ServiceRequest', serviceRequests, patientId),
    ]);
  return {
    records,
    conditions,
    consultations,
    treatments,
    consultationTreatmentCounts,
    serviceRequests,
    consultationServiceRequestCounts,
    actionDays,
  };
}

/** Displays the active patient's records and routes observations to their histories. */
export function HomeView() {
  const router = useRouter();
  const isWideWindow = useIsWideLayout();
  const pathname = usePathname();
  const {
    activePatient,
    activePatientId,
    patients,
    isLoading: isPatientLoading,
    refreshPatients,
  } = useActivePatient();
  // Null until the profile's data first loads; later loads keep it on screen.
  const [data, setData] = useState<HomeData | null>(
    () => homeDataCache.get(activePatientId) ?? null
  );
  const {
    records,
    conditions,
    consultations,
    treatments,
    consultationTreatmentCounts,
    serviceRequests,
    consultationServiceRequestCounts,
    actionDays,
  } = data ?? EMPTY_HOME_DATA;

  // With no profile (fresh install or all profiles deleted), start at Welcome.
  useEffect(() => {
    if (pathname !== '/') return;
    if (!isPatientLoading && patients.length === 0) {
      let isMounted = true;
      getAllPatients().then((actualPatients) => {
        if (!isMounted) return;
        if (actualPatients.length === 0) {
          router.replace('/welcome');
        } else {
          refreshPatients();
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [pathname, isPatientLoading, patients.length, refreshPatients, router]);

  // Floating + menu state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);

  const [loadedPatientId, setLoadedPatientId] = useState(activePatientId);
  const activePatientIdRef = useRef(activePatientId);
  const loadGenerationRef = useRef(0);

  // If activePatientId changed, immediately show that profile's last data, or
  // the loading state, during render (recommended React pattern instead of
  // setState inside useEffect)
  if (loadedPatientId !== activePatientId) {
    setLoadedPatientId(activePatientId);
    setData(homeDataCache.get(activePatientId) ?? null);
  }

  useEffect(() => {
    activePatientIdRef.current = activePatientId;
  }, [activePatientId]);

  const loadData = useCallback(async () => {
    const requestedPatientId = activePatientId;
    if (!requestedPatientId) return;
    const currentGeneration = ++loadGenerationRef.current;
    const isCurrent = () =>
      activePatientIdRef.current === requestedPatientId &&
      loadGenerationRef.current === currentGeneration;

    try {
      const loaded = await fetchHomeData(requestedPatientId);
      // Only apply results if this request is still the latest generation and for current patient
      if (!isCurrent()) return;
      homeDataCache.set(requestedPatientId, loaded);
      setData(loaded);
    } catch (err) {
      if (isCurrent()) {
        console.error('Failed to load dashboard data:', err);
        // Clear records on error so previous/stale records are not exposed
        homeDataCache.delete(requestedPatientId);
        setData(EMPTY_HOME_DATA);
      }
    }
  }, [activePatientId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useDatabaseSubscription(
    [
      'conditions',
      'diagnostic_reports',
      'observations',
      'consultations',
      'medication_requests',
      'medication_administrations',
      'medication_statements',
      'procedures',
      'service_requests',
      'clinical_documents',
    ],
    () => {
      loadData();
    }
  );

  const getConsultationDate = (consultation: Encounter) =>
    consultation.actualPeriod?.start || consultation.plannedStartDate || '';
  const recentConsultations = [...consultations].sort((a, b) =>
    getConsultationDate(b).localeCompare(getConsultationDate(a))
  );

  const countConditionConsultations = (conditionId: string) =>
    consultations.filter(
      (consultation) =>
        getConsultationConditionIds(consultation).includes(conditionId) ||
        getConsultationReasonConditionIds(consultation).includes(conditionId)
    ).length;
  const countConditionTreatments = (conditionId: string) =>
    treatments.filter((treatment) =>
      getTreatmentReasonConditionIds(treatment).includes(conditionId)
    ).length;
  const countConditionServiceRequests = (conditionId: string) =>
    serviceRequests.filter((request) =>
      getReasonConditionIds(request).includes(conditionId)
    ).length;
  const countConsultationConditions = (consultation: Encounter) =>
    new Set([
      ...getConsultationConditionIds(consultation),
      ...getConsultationReasonConditionIds(consultation),
    ]).size;

  const hasAnyData =
    records.length > 0 ||
    conditions.length > 0 ||
    consultations.length > 0 ||
    treatments.length > 0 ||
    serviceRequests.length > 0;
  const hasJournal = actionDays.some(
    (day) => day.items.length + (day.procedures?.length ?? 0) > 0
  );
  // Desktop: how you're doing beside what's going on, once there is both.
  // The overview's biomarkers keep their own filters, apart from the
  // Biomarkers page's.
  const [overviewFilters, setOverviewFilters, overviewFiltersLoaded] =
    useSavedFilters(
      activePatientId ? `home-biomarkers:${activePatientId}` : null,
      DEFAULT_LABS_SUMMARY_FILTERS,
      parseLabsSummaryFilters
    );
  const isOverview =
    isWideWindow &&
    (hasJournal || records.length > 0) &&
    conditions.length +
      treatments.length +
      serviceRequests.length +
      recentConsultations.length >
      0;

  // Journal: the last 7 days of treatment logs
  const journal = hasJournal && (
    <ResourceSection
      icon={ListChecks}
      title="Journal"
      testID="home-actions-section"
      pressLabel="Open journal"
      pressTestID="home-actions-open"
      onPress={() => {
        blurActiveElement();
        router.push('/journal');
      }}
    >
      <ActionWeekStrip
        days={actionDays}
        today={actionDays[actionDays.length - 1].date}
        onOpenDay={(date) => {
          blurActiveElement();
          router.push({ pathname: '/journal', params: { date } });
        }}
      />
    </ResourceSection>
  );
  // Conditions Section
  const conditionsSection = conditions.length > 0 && (
    <ResourceSection
      icon={FolderPlus}
      title="Conditions"
      count={conditions.length}
      testID="home-conditions-section"
    >
      <CollapsibleList
        items={conditions}
        testID="conditions-list"
        renderItem={(condition) => {
          const condId = condition.id || '';
          return (
            <View key={condId} testID={`condition-card-${condId}`}>
              <ConditionRelatedRow
                condition={condition}
                testID={`condition-open-${condId}`}
                onPress={() => {
                  blurActiveElement();
                  router.push(`/condition/${condId}`);
                }}
                extraMeta={withoutZeroCounts([
                  countMeta(
                    Stethoscope,
                    countConditionConsultations(condId),
                    'consultations',
                    `condition-consultations-count-${condId}`
                  ),
                  countMeta(
                    Pill,
                    countConditionTreatments(condId),
                    'treatments',
                    `condition-treatments-count-${condId}`
                  ),
                  countMeta(
                    ClipboardList,
                    countConditionServiceRequests(condId),
                    'service requests',
                    `condition-service-request-count-${condId}`
                  ),
                ])}
              />
            </View>
          );
        }}
      />
    </ResourceSection>
  );
  // Biomarkers: the latest result of each, as a status grid
  // On wide screens the overview has room for every biomarker by status.
  const biomarkers = records.length > 0 && (
    <LabsSummary
      records={records}
      showAll={isOverview}
      filters={overviewFilters}
      // A change before the saved filters load would overwrite them.
      onFiltersChange={overviewFiltersLoaded ? setOverviewFilters : undefined}
    />
  );
  // Treatments Section
  const treatmentsSection = treatments.length > 0 && (
    <ResourceSection
      icon={Pill}
      title="Treatments"
      count={treatments.length}
      testID="home-treatments-section"
      pressLabel="Open treatments"
      pressTestID="home-treatments-open"
      onPress={() => {
        blurActiveElement();
        router.push('/treatments');
      }}
    >
      {treatments.map((treatment) => {
        const treatId = treatment.id || '';
        return (
          <View key={treatId} testID={`treatment-card-${treatId}`}>
            <TreatmentRelatedRow
              treatment={treatment}
              testID={`treatment-open-${treatId}`}
              onPress={() => {
                blurActiveElement();
                router.push({
                  pathname: '/treatment/[id]',
                  params: { id: treatId },
                });
              }}
              extraMeta={withoutZeroCounts([
                countMeta(
                  FolderPlus,
                  getTreatmentReasonConditionIds(treatment).length,
                  'conditions',
                  `treatment-conditions-count-${treatId}`
                ),
              ])}
            />
          </View>
        );
      })}
    </ResourceSection>
  );
  // Service Requests Section
  const serviceRequestsSection = serviceRequests.length > 0 && (
    <ResourceSection
      icon={ClipboardList}
      title="Service requests"
      count={serviceRequests.length}
      testID="home-service-requests-section"
    >
      {serviceRequests.map((request) => {
        const requestId = request.id || '';
        return (
          <View key={requestId} testID={`service-request-card-${requestId}`}>
            <ServiceRequestRelatedRow
              request={request}
              testID={`service-request-open-${requestId}`}
              onPress={() => {
                blurActiveElement();
                router.push({
                  pathname: '/service-request/[id]',
                  params: { id: requestId },
                });
              }}
              extraMeta={withoutZeroCounts([
                countMeta(
                  FolderPlus,
                  getReasonConditionIds(request).length,
                  'conditions',
                  `service-request-conditions-count-${requestId}`
                ),
              ])}
            />
          </View>
        );
      })}
    </ResourceSection>
  );
  // Consultations Section
  const consultationsSection = recentConsultations.length > 0 && (
    <ResourceSection
      icon={Stethoscope}
      title="Consultations"
      count={recentConsultations.length}
      testID="home-consultations-section"
    >
      <CollapsibleList
        items={recentConsultations}
        testID="consultations-list"
        renderItem={(consultation) => {
          const consId = consultation.id || '';
          return (
            <View key={consId} testID={`consultation-card-${consId}`}>
              <ConsultationRelatedRow
                consultation={consultation}
                testID={`consultation-open-${consId}`}
                onPress={() => {
                  blurActiveElement();
                  router.push({
                    pathname: '/consultation/[id]',
                    params: { id: consId },
                  });
                }}
                extraMeta={withoutZeroCounts([
                  countMeta(
                    FolderPlus,
                    countConsultationConditions(consultation),
                    'conditions',
                    `consultation-conditions-count-${consId}`
                  ),
                  countMeta(
                    Pill,
                    consultationTreatmentCounts[consId] || 0,
                    'treatments',
                    `consultation-treatments-count-${consId}`
                  ),
                  countMeta(
                    ClipboardList,
                    consultationServiceRequestCounts[consId] || 0,
                    'service requests',
                    `consultation-service-request-count-${consId}`
                  ),
                ])}
              />
            </View>
          );
        }}
      />
    </ResourceSection>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        {!data ? (
          <ResourceSkeleton testID="home-skeleton" />
        ) : !hasAnyData ? (
          <StartYourRecord
            patient={activePatient}
            profileCount={patients.length}
          />
        ) : (
          /* Results and Conditions View */
          <ScrollView
            testID="results-scroll-view"
            keyboardShouldPersistTaps="handled"
            style={styles.scrollList}
            contentContainerStyle={[
              styles.scrollListContent,
              isOverview && styles.scrollListContentWide,
            ]}
          >
            {isOverview ? (
              <View style={styles.overview}>
                {/* How you are doing: the journal and your results */}
                <View style={styles.overviewColumn}>
                  {journal}
                  {biomarkers}
                </View>
                {/* What is going on: conditions and their care */}
                <View style={styles.overviewColumn}>
                  {conditionsSection}
                  {treatmentsSection}
                  {serviceRequestsSection}
                  {consultationsSection}
                </View>
              </View>
            ) : (
              <>
                {journal}
                {conditionsSection}
                {biomarkers}
                {treatmentsSection}
                {serviceRequestsSection}
                {consultationsSection}
              </>
            )}
          </ScrollView>
        )}

        <FloatingAddMenu
          visible={showAddMenu}
          onClose={() => setShowAddMenu(false)}
          options={[
            {
              id: 'condition',
              label: 'Condition',
              testID: 'menu-add-condition',
              icon: (
                <FolderPlus
                  color={COLORS.light.primary}
                  size={18}
                  style={{ marginRight: 10 }}
                />
              ),
              onPress: () => router.push('/condition/add'),
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
              onPress: () => router.push('/treatment/add'),
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
              onPress: () => router.push('/service-request/add'),
            },
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
              onPress: () => router.push('/consultation/add'),
            },
            {
              id: 'lab-results',
              label: 'Lab Results',
              testID: 'menu-add-lab-results',
              icon: (
                <FileText
                  color={COLORS.light.primary}
                  size={18}
                  style={{ marginRight: 10 }}
                />
              ),
              onPress: () => router.push('/lab-result/add'),
            },
          ]}
        />

        {/* Import with AI leads; the empty state's rows are how to start by
            hand, so + comes with the first record. */}
        <ResourceActionDock
          actions={[
            {
              label: 'Import with AI',
              testID: 'home-import-with-ai-button',
              icon: Sparkles,
              primary: true,
              onPress: () => {
                setShowAddMenu(false);
                setShowAIImport(true);
              },
            },
            ...(hasAnyData
              ? [
                  {
                    label: 'Add record',
                    testID: 'floating-add-button',
                    icon: Plus,
                    expanded: showAddMenu,
                    onPress: () => setShowAddMenu((visible) => !visible),
                  },
                ]
              : []),
          ]}
        />
        {showAIImport && (
          <AIImportModal
            document="health document, such as a visit summary, referral or prescription"
            outcome="check the records it found"
            instructions={buildAIImportInstructions}
            parse={(reply) => parseAIImportReply(reply)}
            onClose={() => setShowAIImport(false)}
            onImport={async (records) => {
              const conditions = await getAllConditions(activePatientId);
              setReview(
                startReview(records, toExistingConditions(conditions)),
                activePatientId
              );
              setShowAIImport(false);
              router.push('/ai-import');
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  container: {
    flex: 1,
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    ...CONTENT_COLUMN,
    padding: 20,
    paddingBottom: 132,
  },
  scrollListContentWide: {
    maxWidth: WIDE_MAX_WIDTH,
  },
  overview: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
  },
  overviewColumn: {
    flex: 1,
    minWidth: 0,
  },
});
