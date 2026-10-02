import { useFocusEffect, useRouter } from 'expo-router';
import {
  Calendar,
  FileText,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiagnosticReportRecord } from '../src/database/types';
import {
  getAllReports,
  deleteReport,
} from '../src/services/diagnosticReportService';
import {
  getAllHealthCases,
  deleteHealthCase,
} from '../src/services/healthCaseService';
import { FHIRObservation, FHIREpisodeOfCare } from '../src/types/fhir';
import { formatDisplayDate } from '../src/utils/dateUtils';
import { COLORS } from '../src/theme/colors';
import { PlusCircleButton } from '../src/components/PlusCircleButton';
import { DeleteConfirmationModal } from '../src/components/DeleteConfirmationModal';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DiagnosticReportRecord[]>([]);
  const [healthCases, setHealthCases] = useState<FHIREpisodeOfCare[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Floating + menu state
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    type: 'report' | 'case';
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
    requireCountdown: false,
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [reportsData, casesData] = await Promise.all([
        getAllReports(),
        getAllHealthCases(),
      ]);
      setRecords(reportsData);
      setHealthCases(casesData);
    } catch (err) {
      console.error('Failed to load records:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const formatDate = (dateStr: string) => {
    return formatDisplayDate(dateStr);
  };

  const navigateToAddReport = (id?: string) => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      (document.activeElement as HTMLElement)?.blur?.();
    }
    if (id) {
      router.push(`/add-report?id=${id}`);
    } else {
      router.push('/add-report');
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

  const handleDeleteCaseClick = (id: string) => {
    setDeleteModal({
      visible: true,
      type: 'case',
      id,
      title: 'Delete Health Case',
      message:
        'Are you sure you want to delete this health case? This action cannot be undone.',
      requireCountdown: false,
    });
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteModal.type === 'report') {
        await deleteReport(deleteModal.id);
      } else {
        await deleteHealthCase(deleteModal.id);
      }
      setDeleteModal((prev) => ({ ...prev, visible: false }));
      await loadData();
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const getStatusBadge = (obs: FHIRObservation) => {
    const interpretationCode = obs.interpretation?.[0]?.coding?.[0]?.code;
    if (!interpretationCode) return null;

    if (interpretationCode === 'N') {
      return (
        <View style={[styles.statusBadge, styles.statusNormal]}>
          <Text style={[styles.statusText, styles.statusTextNormal]}>
            Normal
          </Text>
        </View>
      );
    }
    if (interpretationCode === 'L') {
      return (
        <View style={[styles.statusBadge, styles.statusLow]}>
          <Text style={[styles.statusText, styles.statusTextLow]}>Low</Text>
        </View>
      );
    }
    if (interpretationCode === 'H') {
      return (
        <View style={[styles.statusBadge, styles.statusHigh]}>
          <Text style={[styles.statusText, styles.statusTextHigh]}>High</Text>
        </View>
      );
    }
    return null;
  };

  const getCaseStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; dot: string }> = {
      active: { label: 'Active', dot: '#10B981' },
      onhold: { label: 'On Hold', dot: '#F59E0B' },
      finished: { label: 'Finished', dot: '#717973' },
      cancelled: { label: 'Cancelled', dot: '#F43F5E' },
    };
    const config = statusMap[status] || { label: status, dot: '#717973' };
    return (
      <View style={styles.caseStatusBadge}>
        <View style={[styles.statusDot, { backgroundColor: config.dot }]} />
        <Text style={styles.caseStatusText}>{config.label}</Text>
      </View>
    );
  };

  const hasAnyData = records.length > 0 || healthCases.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.light.primary} />
          </View>
        ) : !hasAnyData ? (
          /* Empty State when no results or health cases yet */
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
          /* Results and Health Cases View */
          <ScrollView
            testID="results-scroll-view"
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
          >
            {/* Health Cases Section */}
            {healthCases.length > 0 && (
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>Health Cases</Text>
                {healthCases.map((caseItem) => {
                  const title =
                    caseItem.type?.[0]?.text ||
                    caseItem.diagnosis?.[0]?.condition?.display ||
                    caseItem.description ||
                    'Health Case';
                  const noteText =
                    caseItem.note && caseItem.note.length > 0
                      ? caseItem.note.map((n) => n.text).join('\n')
                      : null;

                  return (
                    <View
                      key={caseItem.id}
                      style={styles.reportCard}
                      testID={`case-card-${caseItem.id}`}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          {getCaseStatusBadge(caseItem.status)}
                          {caseItem.period?.start && (
                            <View style={styles.caseDateContainer}>
                              <Calendar
                                color={COLORS.light.iconMuted}
                                size={14}
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.cardDate}>
                                {formatDate(caseItem.period.start)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.cardHeaderActions}>
                          <TouchableOpacity
                            testID={`edit-case-button-${caseItem.id}`}
                            style={styles.editReportButton}
                            onPress={() =>
                              router.push(`/health-case/${caseItem.id}/edit`)
                            }
                            activeOpacity={0.7}
                          >
                            <Pencil color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`delete-case-button-${caseItem.id}`}
                            style={styles.deleteReportButton}
                            onPress={() => handleDeleteCaseClick(caseItem.id)}
                            activeOpacity={0.7}
                          >
                            <Trash2 color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={styles.caseTitleContainer}>
                        <Text style={styles.caseTitleText}>{title}</Text>
                      </View>

                      {noteText && (
                        <View style={styles.cardNoteContainer}>
                          <Text style={styles.cardNoteText}>
                            &quot;{noteText}&quot;
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Lab Results Section */}
            {records.length > 0 && (
              <View style={styles.sectionContainer}>
                {healthCases.length > 0 && (
                  <Text style={styles.sectionTitle}>Lab Results</Text>
                )}
                {records.map((record) => {
                  const noteText =
                    record.report.note && record.report.note.length > 0
                      ? record.report.note.map((n) => n.text).join('\n')
                      : null;

                  return (
                    <View
                      key={record.report.id}
                      style={styles.reportCard}
                      testID={`report-card-${record.report.id}`}
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
                            testID={`edit-report-button-${record.report.id}`}
                            style={styles.editReportButton}
                            onPress={() =>
                              navigateToAddReport(record.report.id)
                            }
                            activeOpacity={0.7}
                          >
                            <Pencil color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`delete-report-button-${record.report.id}`}
                            style={styles.deleteReportButton}
                            onPress={() =>
                              handleDeleteReportClick(record.report.id)
                            }
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

                      {/* Observations Telemetry Rows */}
                      <View style={styles.observationsContainer}>
                        {record.observations.map((obs) => {
                          const markerName =
                            obs.code.coding?.[0]?.display ||
                            obs.code.text ||
                            'Biomarker';
                          const value = obs.valueQuantity?.value;
                          const unit =
                            obs.valueQuantity?.unit ||
                            obs.valueQuantity?.code ||
                            '';
                          const refLow = obs.referenceRange?.[0]?.low?.value;
                          const refHigh = obs.referenceRange?.[0]?.high?.value;

                          return (
                            <View
                              key={obs.id}
                              style={styles.observationRow}
                              testID={`obs-row-${obs.id}`}
                            >
                              <View style={styles.obsLeft}>
                                <Text style={styles.obsName}>{markerName}</Text>
                                {refLow !== undefined &&
                                  refHigh !== undefined && (
                                    <Text style={styles.obsReference}>
                                      Ref: {refLow} - {refHigh} {unit}
                                    </Text>
                                  )}
                              </View>

                              <View style={styles.obsRight}>
                                <View style={styles.valueGroup}>
                                  <Text style={styles.obsValue}>{value}</Text>
                                  <Text style={styles.obsUnit}>{unit}</Text>
                                </View>
                                {getStatusBadge(obs)}
                              </View>
                            </View>
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

        {/* Floating Add Menu & Backdrop */}
        {showAddMenu && (
          <TouchableWithoutFeedback onPress={() => setShowAddMenu(false)}>
            <View style={styles.floatingMenuBackdrop} />
          </TouchableWithoutFeedback>
        )}

        {showAddMenu && (
          <View style={styles.floatingMenu} testID="floating-add-menu">
            <TouchableOpacity
              testID="menu-add-health-case"
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/health-case/add');
              }}
              activeOpacity={0.7}
            >
              <FolderPlus
                color={COLORS.light.primary}
                size={18}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.menuItemText}>Add Health Case</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              testID="menu-add-lab-results"
              style={styles.menuItem}
              onPress={() => {
                setShowAddMenu(false);
                router.push('/add-report');
              }}
              activeOpacity={0.7}
            >
              <FileText
                color={COLORS.light.primary}
                size={18}
                style={{ marginRight: 10 }}
              />
              <Text style={styles.menuItemText}>Add Lab Results</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Add Button at bottom middle */}
        <View style={styles.floatingButtonContainer} pointerEvents="box-none">
          <PlusCircleButton
            testID="floating-add-button"
            variant="primary"
            onPress={() => setShowAddMenu((prev) => !prev)}
            style={styles.floatingButton}
          />
        </View>

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
    backgroundColor: COLORS.light.background,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.light.emptyIconContainer,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 80,
    gap: 16,
  },
  sectionContainer: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 4,
  },
  reportCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebCard,
      },
      default: {
        shadowColor: COLORS.light.cardShadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
    marginBottom: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  cardHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editReportButton: {
    padding: 6,
    borderRadius: 8,
  },
  deleteReportButton: {
    padding: 6,
    borderRadius: 8,
  },
  caseStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  caseStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  caseDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caseTitleContainer: {
    marginTop: 10,
  },
  caseTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  cardNoteContainer: {
    marginTop: 8,
    backgroundColor: COLORS.light.background,
    padding: 8,
    borderRadius: 8,
  },
  cardNoteText: {
    fontSize: 13,
    color: COLORS.light.textSecondary,
    fontStyle: 'italic',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.light.divider,
    marginVertical: 12,
  },
  observationsContainer: {
    gap: 12,
  },
  observationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  obsLeft: {
    flex: 1,
    marginRight: 12,
  },
  obsName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  obsReference: {
    fontSize: 12,
    color: COLORS.light.muted,
    marginTop: 2,
  },
  obsRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  valueGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  obsValue: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.light.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  obsUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.light.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusNormal: {
    backgroundColor: COLORS.light.badgeNormalBg,
    borderColor: COLORS.light.badgeNormalBorder,
  },
  statusLow: {
    backgroundColor: COLORS.light.badgeLowBg,
    borderColor: COLORS.light.badgeLowBorder,
  },
  statusHigh: {
    backgroundColor: COLORS.light.badgeHighBg,
    borderColor: COLORS.light.badgeHighBorder,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextNormal: {
    color: COLORS.light.badgeNormalText,
  },
  statusTextLow: {
    color: COLORS.light.badgeLowText,
  },
  statusTextHigh: {
    color: COLORS.light.badgeHighText,
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  floatingButton: {
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
      },
    }),
  },
  floatingMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 40,
  },
  floatingMenu: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    paddingVertical: 6,
    width: 180,
    zIndex: 45,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebDropdown,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 6,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.light.divider,
    marginVertical: 2,
  },
});
