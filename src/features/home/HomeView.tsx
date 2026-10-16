import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import {
  Calendar,
  ClipboardList,
  FileText,
  FolderPlus,
  ListChecks,
  Pencil,
  Pill,
  Stethoscope,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiagnosticReportRecord } from '@/src/database/types';
import {
  getAllReports,
  deleteReport,
} from '@/src/features/lab-results/diagnosticReportService';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import { getAllConsultations } from '@/src/features/consultations/consultationService';
import {
  getAllTreatments,
  getConsultationIdsLinkingTreatment,
} from '@/src/features/treatments/treatmentService';
import {
  getAllServiceRequests,
  getConsultationIdsLinkingServiceRequest,
} from '@/src/features/service-requests/serviceRequestService';
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
  Observation,
  Condition,
  Encounter,
  MedicationRequest,
  ServiceRequest,
} from 'fhir/r5';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getTreatmentReasonConditionIds,
  getReasonConditionIds,
} from '@/src/utils/fhirUtils';

import { COLORS } from '@/src/theme/colors';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllPatients } from '@/src/features/profile/patientService';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import {
  getObservationReferenceRange,
  getObservationStatus,
  isSupportedCBCObservation,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';

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

/** Displays the active patient's records and routes observations to their histories. */
export function HomeView() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activePatientId,
    patients,
    isLoading: isPatientLoading,
    refreshPatients,
  } = useActivePatient();
  const [records, setRecords] = useState<DiagnosticReportRecord[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [treatments, setTreatments] = useState<MedicationRequest[]>([]);
  const [consultationTreatmentCounts, setConsultationTreatmentCounts] =
    useState<Record<string, number>>({});
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [
    consultationServiceRequestCounts,
    setConsultationServiceRequestCounts,
  ] = useState<Record<string, number>>({});
  const [actionDays, setActionDays] = useState<ActionDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // If no patients exist in the app (fresh install or all profiles deleted), redirect immediately to /profile/new
  useEffect(() => {
    if (pathname !== '/') return;
    if (!isPatientLoading && patients.length === 0) {
      let isMounted = true;
      getAllPatients().then((actualPatients) => {
        if (!isMounted) return;
        if (actualPatients.length === 0) {
          router.replace('/profile/new');
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

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    type: 'report';
    id: string;
    title: string;
    message: string;
    requireCountdown: boolean;
  }>({
    visible: false,
    type: 'report',
    id: '',
    title: '',
    message: '',
    requireCountdown: true,
  });

  const [loadedPatientId, setLoadedPatientId] = useState(activePatientId);
  const activePatientIdRef = useRef(activePatientId);
  const loadGenerationRef = useRef(0);

  // If activePatientId changed, immediately reset displayed records and loading state
  // during render (recommended React pattern instead of setState inside useEffect)
  if (loadedPatientId !== activePatientId) {
    setLoadedPatientId(activePatientId);
    setRecords([]);
    setConditions([]);
    setConsultations([]);
    setTreatments([]);
    setConsultationTreatmentCounts({});
    setServiceRequests([]);
    setConsultationServiceRequestCounts({});
    setActionDays([]);
    setIsLoading(true);
  }

  useEffect(() => {
    activePatientIdRef.current = activePatientId;
  }, [activePatientId]);

  const loadData = useCallback(async () => {
    const requestedPatientId = activePatientId;
    const currentGeneration = ++loadGenerationRef.current;

    try {
      setIsLoading(true);
      const [
        reportsData,
        conditionsData,
        consultationsData,
        treatmentsData,
        serviceRequestsData,
        actionDaysData,
      ] = await Promise.all([
        getAllReports(requestedPatientId),
        getAllConditions(requestedPatientId),
        getAllConsultations(requestedPatientId),
        getAllTreatments(requestedPatientId),
        getAllServiceRequests(requestedPatientId),
        getActionDays(requestedPatientId, daysEndingOn(todayKey())),
      ]);

      // Counts each record once per consultation whose document lists it.
      const countConsultationLinks = async (
        items: { id?: string }[],
        lookup: (id: string, patientId: string) => Promise<string[]>
      ) => {
        const linkedIds = await Promise.all(
          items.map((item) =>
            item.id
              ? lookup(item.id, requestedPatientId).catch((error) => {
                  // A failed link lookup only loses that record's count.
                  console.warn('Failed to load consultation links:', error);
                  return [] as string[];
                })
              : Promise.resolve([])
          )
        );
        const counts: Record<string, number> = {};
        for (const consultationIds of linkedIds)
          for (const consultationId of new Set(consultationIds))
            counts[consultationId] = (counts[consultationId] || 0) + 1;
        return counts;
      };
      const [treatmentCounts, serviceRequestCounts] = await Promise.all([
        countConsultationLinks(
          treatmentsData,
          getConsultationIdsLinkingTreatment
        ),
        countConsultationLinks(
          serviceRequestsData,
          getConsultationIdsLinkingServiceRequest
        ),
      ]);

      // Only apply results if this request is still the latest generation and for current patient
      if (
        activePatientIdRef.current !== requestedPatientId ||
        loadGenerationRef.current !== currentGeneration
      ) {
        return;
      }
      setRecords(reportsData);
      setConditions(conditionsData);
      setConsultations(consultationsData);
      setTreatments(treatmentsData);
      setConsultationTreatmentCounts(treatmentCounts);
      setServiceRequests(serviceRequestsData);
      setConsultationServiceRequestCounts(serviceRequestCounts);
      setActionDays(actionDaysData);
    } catch (err) {
      if (
        activePatientIdRef.current === requestedPatientId &&
        loadGenerationRef.current === currentGeneration
      ) {
        console.error('Failed to load dashboard data:', err);
        // Keep records cleared on error so previous/stale records are not exposed
        setRecords([]);
        setConditions([]);
        setConsultations([]);
        setTreatments([]);
        setServiceRequests([]);
        setActionDays([]);
      }
    } finally {
      if (
        activePatientIdRef.current === requestedPatientId &&
        loadGenerationRef.current === currentGeneration
      ) {
        setIsLoading(false);
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
      'service_requests',
      'clinical_documents',
    ],
    () => {
      loadData();
    }
  );

  const formatDate = (dateStr: string) => {
    return formatDisplayDateTime(dateStr);
  };

  const navigateToAddReport = (id?: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    if (id) {
      router.push(`/lab-result/${id}/edit`);
    } else {
      router.push('/lab-result/add');
    }
  };

  const handleDeleteReportClick = (id: string) => {
    setDeleteModal({
      visible: true,
      type: 'report',
      id,
      title: 'Delete Lab Result',
      message:
        'Are you sure you want to delete this lab result? This action cannot be undone.',
      requireCountdown: true,
    });
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteReport(deleteModal.id);
      setDeleteModal((prev) => ({ ...prev, visible: false }));
      await loadData();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  /** Renders a consistent interpreted or reference-range status for a result. */
  const getStatusBadge = (obs: Observation) => {
    const status = getObservationStatus(obs);

    if (!status) return null;

    let badgeText = 'Normal';
    let badgeStyle: any = styles.badgeNormal;
    let textStyle: any = styles.badgeTextNormal;

    if (status === 'Low') {
      badgeText = 'Low';
      badgeStyle = styles.badgeLow;
      textStyle = styles.badgeTextLow;
    } else if (status === 'High') {
      badgeText = 'High';
      badgeStyle = styles.badgeHigh;
      textStyle = styles.badgeTextHigh;
    }

    return (
      <View style={[styles.badge, badgeStyle]}>
        <Text style={[styles.badgeText, textStyle]}>{badgeText}</Text>
      </View>
    );
  };

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.light.primary} />
          </View>
        ) : !hasAnyData ? (
          /* Empty State when no results or conditions yet */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FileText color={COLORS.light.primary} size={36} />
            </View>
            <Text style={styles.emptyTitle}>Nothing to show yet</Text>
            <Text style={styles.emptySubtitle}>
              Track changes to your biomarkers over time by adding test results.
            </Text>
          </View>
        ) : (
          /* Results and Conditions View */
          <ScrollView
            testID="results-scroll-view"
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
          >
            {/* Journal: the last 7 days of treatment logs */}
            {actionDays.some((day) => day.items.length > 0) && (
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
            )}

            {/* Conditions Section */}
            {conditions.length > 0 && (
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
            )}

            {/* Treatments Section */}
            {treatments.length > 0 && (
              <ResourceSection
                icon={Pill}
                title="Treatments"
                count={treatments.length}
                testID="home-treatments-section"
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
            )}

            {/* Service Requests Section */}
            {serviceRequests.length > 0 && (
              <ResourceSection
                icon={ClipboardList}
                title="Service requests"
                count={serviceRequests.length}
                testID="home-service-requests-section"
              >
                {serviceRequests.map((request) => {
                  const requestId = request.id || '';
                  return (
                    <View
                      key={requestId}
                      testID={`service-request-card-${requestId}`}
                    >
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
            )}

            {/* Consultations Section */}
            {recentConsultations.length > 0 && (
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
            )}

            {/* Diagnostic Reports Section */}
            {records.length > 0 && (
              <View style={[styles.sectionContainer, styles.maxWidthSection]}>
                {(conditions.length > 0 ||
                  treatments.length > 0 ||
                  serviceRequests.length > 0 ||
                  consultations.length > 0) && (
                  <Text style={styles.sectionTitle}>Lab Results</Text>
                )}
                {records.map((record) => {
                  const noteText =
                    record.report.note && record.report.note.length > 0
                      ? record.report.note.map((n) => n.text).join('\n')
                      : null;

                  const reportId = record.report.id || '';

                  return (
                    <View
                      key={reportId || 'report'}
                      style={styles.reportCard}
                      testID={`report-card-${reportId}`}
                    >
                      {/* Card Header: Date & Action Icons */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Calendar
                            color={COLORS.light.iconMuted}
                            size={16}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.cardDate}>
                            {formatDate(record.report.effectiveDateTime || '')}
                          </Text>
                        </View>
                        <View style={styles.cardHeaderActions}>
                          <TouchableOpacity
                            testID={`edit-report-button-${reportId}`}
                            style={styles.editReportButton}
                            onPress={() => navigateToAddReport(reportId)}
                            activeOpacity={0.7}
                          >
                            <Pencil color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`delete-report-button-${reportId}`}
                            style={styles.deleteReportButton}
                            onPress={() => handleDeleteReportClick(reportId)}
                            activeOpacity={0.7}
                          >
                            <Trash2 color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Notes if available */}
                      {noteText && (
                        <View style={styles.cardNoteContainer}>
                          <Text style={styles.cardNoteText}>
                            &quot;{noteText}&quot;
                          </Text>
                        </View>
                      )}

                      {/* Divider */}
                      <View style={styles.cardDivider} />

                      {/* Observations List */}
                      <View style={styles.obsList}>
                        {record.observations
                          .filter(isSupportedCBCObservation)
                          .map((obs) => {
                            const name =
                              obs.code?.coding?.[0]?.display ||
                              obs.code?.text ||
                              'Observation';
                            const value = obs.valueQuantity?.value ?? '-';
                            const unit =
                              obs.valueQuantity?.unit ||
                              obs.valueQuantity?.code ||
                              '';

                            return (
                              <TouchableOpacity
                                key={obs.id}
                                style={styles.obsItem}
                                testID={`biomarker-row-${obs.code?.coding?.[0]?.code || obs.id}`}
                                accessibilityRole="button"
                                accessibilityLabel={`View biomarker: ${name}`}
                                onPress={() =>
                                  router.push({
                                    pathname: '/biomarker/[id]',
                                    params: {
                                      id:
                                        obs.code?.coding?.[0]?.code === 'custom'
                                          ? name
                                          : obs.code?.coding?.[0]?.code || name,
                                    },
                                  })
                                }
                                activeOpacity={0.75}
                              >
                                <View style={styles.obsLeft}>
                                  <Text style={styles.obsName}>{name}</Text>
                                  {obs.code?.coding?.[0]?.code &&
                                    obs.code?.coding?.[0]?.code !==
                                      'custom' && (
                                      <Text style={styles.obsLoinc}>
                                        LOINC: {obs.code.coding[0].code}
                                      </Text>
                                    )}
                                </View>

                                <View style={styles.obsRight}>
                                  <View style={styles.valueGroup}>
                                    <Text style={styles.obsValue}>{value}</Text>
                                    <Text style={styles.obsUnit}>{unit}</Text>
                                  </View>
                                  <View style={styles.obsStatusRangeRow}>
                                    {getStatusBadge(obs)}
                                    {typeof obs.valueQuantity?.value ===
                                      'number' && (
                                      <BiomarkerRangeLine
                                        value={obs.valueQuantity.value}
                                        {...getObservationReferenceRange(obs)}
                                        testID={`biomarker-range-line-${obs.code?.coding?.[0]?.code || obs.id || 'unknown'}`}
                                      />
                                    )}
                                  </View>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                      </View>
                    </View>
                  );
                })}
              </View>
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

        <ResourceActionDock
          onAdd={() => setShowAddMenu((visible) => !visible)}
          addLabel="Add record"
          addTestID="floating-add-button"
          addMenuExpanded={showAddMenu}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          visible={deleteModal.visible}
          title={deleteModal.title}
          message={deleteModal.message}
          requireCountdown={deleteModal.requireCountdown}
          onConfirm={handleConfirmDelete}
          onCancel={() =>
            setDeleteModal((prev) => ({ ...prev, visible: false }))
          }
        />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.light.pillBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    padding: 20,
    paddingBottom: 132,
  },
  sectionContainer: {
    marginBottom: 16,
  },
  maxWidthSection: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 12,
    marginLeft: 2,
  },
  reportCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  editReportButton: {
    padding: 6,
    borderRadius: 6,
  },
  deleteReportButton: {
    padding: 6,
    borderRadius: 6,
  },
  cardNoteContainer: {
    backgroundColor: COLORS.light.pillBackground,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardNoteText: {
    fontSize: 13,
    color: COLORS.light.muted,
    fontStyle: 'italic',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.light.border,
    marginBottom: 12,
  },
  obsList: {
    gap: 12,
  },
  obsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  obsLeft: {
    flex: 1,
    marginRight: 12,
  },
  obsName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
    marginBottom: 2,
  },
  obsLoinc: {
    fontSize: 12,
    color: COLORS.light.muted,
  },
  obsRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  obsStatusRangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  obsValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  obsUnit: {
    fontSize: 13,
    color: COLORS.light.muted,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeNormal: {
    backgroundColor: COLORS.light.badgeNormalBg,
  },
  badgeLow: {
    backgroundColor: COLORS.light.badgeLowBg,
  },
  badgeHigh: {
    backgroundColor: COLORS.light.badgeHighBg,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextNormal: {
    color: COLORS.light.badgeNormalText,
  },
  badgeTextLow: {
    color: COLORS.light.badgeLowText,
  },
  badgeTextHigh: {
    color: COLORS.light.badgeHighText,
  },
});
