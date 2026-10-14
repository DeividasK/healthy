import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import {
  Calendar,
  Clock,
  FileText,
  FolderPlus,
  Pencil,
  Pill,
  Stethoscope,
  Trash2,
  User,
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
import { getAllTreatments } from '@/src/features/treatments/treatmentService';
import {
  getTreatmentIntentLabel,
  getTreatmentStatusLabel,
} from '@/src/features/treatments/treatmentLabels';

import type {
  Observation,
  Condition,
  Encounter,
  MedicationRequest,
} from 'fhir/r5';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConditionTitle,
  getConditionNotes,
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getTreatmentTitle,
  getTreatmentInstructions,
} from '@/src/utils/fhirUtils';

import { COLORS } from '@/src/theme/colors';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllPatients } from '@/src/features/profile/patientService';
import { useSync } from '@/src/context/SyncContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import {
  getObservationReferenceRange,
  getObservationStatus,
  isSupportedCBCObservation,
} from '@/src/features/lab-results/biomarkerMeasurements';
import { BiomarkerRangeLine } from '@/src/components/BiomarkerRangeLine';

/** Displays the active patient's records and routes observations to their histories. */
export function HomeView() {
  const router = useRouter();
  const pathname = usePathname();
  const { triggerSync } = useSync();
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
      const [reportsData, conditionsData, consultationsData, treatmentsData] =
        await Promise.all([
          getAllReports(requestedPatientId),
          getAllConditions(requestedPatientId),
          getAllConsultations(requestedPatientId),
          getAllTreatments(requestedPatientId),
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
      triggerSync().catch((err) =>
        console.warn('Background sync failed on delete:', err)
      );
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

  const getConditionStatusBadge = (condition: Condition) => {
    const clinicalStatus =
      condition.clinicalStatus?.coding?.[0]?.code || 'active';
    const verificationStatus =
      condition.verificationStatus?.coding?.[0]?.code || 'unconfirmed';

    let label = 'Active';
    let dot = '#10B981';

    if (verificationStatus === 'unconfirmed') {
      label = 'Unconfirmed';
      dot = '#F59E0B';
    } else if (verificationStatus === 'provisional') {
      label = 'Provisional';
      dot = '#3B82F6';
    } else if (clinicalStatus === 'inactive') {
      label = 'Inactive';
      dot = '#6B7280';
    } else if (clinicalStatus === 'remission') {
      label = 'Remission';
      dot = '#8B5CF6';
    } else if (clinicalStatus === 'resolved') {
      label = 'Resolved';
      dot = '#717973';
    }

    return (
      <View style={styles.conditionStatusBadge}>
        <View style={[styles.statusDot, { backgroundColor: dot }]} />
        <Text style={styles.conditionStatusText}>{label}</Text>
      </View>
    );
  };

  const standaloneConsultations = consultations.filter(
    (c) =>
      getConsultationConditionIds(c).length === 0 &&
      getConsultationReasonConditionIds(c).length === 0
  );

  const hasAnyData =
    records.length > 0 ||
    conditions.length > 0 ||
    standaloneConsultations.length > 0 ||
    treatments.length > 0;

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
            {/* Conditions Section */}
            {conditions.length > 0 && (
              <View style={[styles.sectionContainer, styles.maxWidthSection]}>
                <Text style={styles.sectionTitle}>Conditions</Text>
                {conditions.map((conditionItem) => {
                  const title = getConditionTitle(conditionItem);
                  const noteText = getConditionNotes(conditionItem);
                  const condId = conditionItem.id || '';

                  return (
                    <TouchableOpacity
                      key={condId || 'condition'}
                      style={styles.reportCard}
                      testID={`condition-card-${condId}`}
                      activeOpacity={0.8}
                      onPress={() => {
                        if (
                          Platform.OS === 'web' &&
                          typeof document !== 'undefined'
                        ) {
                          (document.activeElement as HTMLElement)?.blur?.();
                        }
                        router.push(`/condition/${condId}`);
                      }}
                    >
                      {/* Card Header: Status and Date */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          {getConditionStatusBadge(conditionItem)}
                          <Calendar
                            color={COLORS.light.iconMuted}
                            size={16}
                            style={{ marginLeft: 8, marginRight: 6 }}
                          />
                          <Text style={styles.cardDate}>
                            {formatDate(conditionItem.onsetDateTime || '')}
                          </Text>
                        </View>
                      </View>

                      {/* Condition Title */}
                      <View style={styles.conditionTitleContainer}>
                        <Text style={styles.conditionTitleText}>{title}</Text>
                      </View>

                      {/* Notes / Description if available */}
                      {noteText && (
                        <View style={styles.cardNoteContainer}>
                          <Text style={styles.cardNoteText}>
                            &quot;{noteText}&quot;
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Treatments Section */}
            {treatments.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Treatments</Text>
                {treatments.map((treatment) => {
                  const treatId = treatment.id || '';
                  const treatTitle = getTreatmentTitle(treatment);
                  const treatInstructions = getTreatmentInstructions(treatment);
                  const treatDate = treatment.authoredOn || '';
                  const treatStatus = getTreatmentStatusLabel(treatment.status);
                  const treatIntent = getTreatmentIntentLabel(
                    treatment.intent,
                    'short'
                  );

                  return (
                    <TouchableOpacity
                      key={treatId || 'treatment'}
                      style={styles.reportCard}
                      testID={`treatment-card-${treatId}`}
                      accessibilityRole="button"
                      accessibilityLabel={`View treatment: ${treatTitle}`}
                      onPress={() => {
                        if (
                          Platform.OS === 'web' &&
                          typeof document !== 'undefined'
                        ) {
                          (document.activeElement as HTMLElement)?.blur?.();
                        }
                        router.push({
                          pathname: '/treatment/[id]',
                          params: { id: treatId },
                        });
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <View style={styles.treatmentBadgesRow}>
                            <View style={styles.conditionStatusBadge}>
                              <Text style={styles.conditionStatusText}>
                                {treatStatus}
                              </Text>
                            </View>
                            <View style={styles.intentBadge}>
                              <Text style={styles.intentBadgeText}>
                                {treatIntent}
                              </Text>
                            </View>
                          </View>
                          {treatDate ? (
                            <>
                              <Calendar
                                color={COLORS.light.iconMuted}
                                size={16}
                                style={{ marginLeft: 8, marginRight: 6 }}
                              />
                              <Text style={styles.cardDate}>
                                {formatDate(treatDate)}
                              </Text>
                            </>
                          ) : null}
                        </View>
                      </View>

                      <Text style={styles.treatmentTitleText}>
                        {treatTitle}
                      </Text>

                      {treatInstructions ? (
                        <View
                          style={styles.instructionsRow}
                          testID={`treatment-card-instructions-${treatId}`}
                        >
                          <Clock
                            color={COLORS.light.iconMuted}
                            size={14}
                            accessibilityLabel="Dosage"
                            style={styles.instructionsIcon}
                          />
                          <Text
                            style={styles.cardInstructionsText}
                            numberOfLines={2}
                          >
                            {treatInstructions}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Diagnostic Reports Section */}
            {records.length > 0 && (
              <View style={[styles.sectionContainer, styles.maxWidthSection]}>
                {conditions.length > 0 && (
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

            {/* Standalone Consultations Section */}
            {standaloneConsultations.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Consultations</Text>
                {standaloneConsultations.map((cons) => {
                  const consId = cons.id || '';
                  const consTitle = getConsultationTitle(cons);
                  const consDoctor = getConsultationDoctor(cons);
                  const consServiceType = getConsultationServiceType(cons);
                  const consNotes = getConsultationNotes(cons);
                  const consDate =
                    cons.actualPeriod?.start || cons.plannedStartDate || '';

                  return (
                    <TouchableOpacity
                      key={consId || 'consultation'}
                      style={styles.reportCard}
                      testID={`consultation-card-${consId}`}
                      accessibilityRole="button"
                      accessibilityLabel={`View consultation: ${consTitle}`}
                      onPress={() =>
                        router.push({
                          pathname: '/consultation/[id]',
                          params: { id: consId },
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          <Calendar
                            color={COLORS.light.iconMuted}
                            size={16}
                            style={{ marginRight: 6 }}
                          />
                          <Text style={styles.cardDate}>
                            {formatDate(consDate)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.consultationTitleText}>
                        {consTitle}
                      </Text>

                      {consServiceType && (
                        <View style={styles.serviceTypeBadge}>
                          <Text style={styles.serviceTypeText}>
                            {consServiceType}
                          </Text>
                        </View>
                      )}

                      {consDoctor && (
                        <View style={styles.doctorRow}>
                          <User
                            color={COLORS.light.iconMuted}
                            size={13}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={styles.doctorText}>{consDoctor}</Text>
                        </View>
                      )}

                      {consNotes && (
                        <View style={styles.cardNoteContainer}>
                          <Text style={styles.cardNoteText}>
                            &quot;{consNotes}&quot;
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
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
    padding: 16,
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
  conditionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  conditionStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  conditionTitleContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  conditionTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  consultationTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginTop: 4,
    marginBottom: 4,
  },
  serviceTypeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  serviceTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.primary,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  doctorText: {
    fontSize: 13,
    color: COLORS.light.muted,
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
  treatmentBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  intentBadge: {
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  intentBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.primary,
  },
  treatmentTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginTop: 4,
    marginBottom: 4,
  },
  instructionsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 6,
  },
  instructionsIcon: {
    marginTop: 2,
  },
  cardInstructionsText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.light.foreground,
    lineHeight: 18,
  },
});
