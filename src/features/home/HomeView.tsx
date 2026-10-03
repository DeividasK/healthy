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
import { DiagnosticReportRecord } from '../../database/types';
import {
  getAllReports,
  deleteReport,
} from '../lab-results/diagnosticReportService';
import {
  getAllHealthCases,
  deleteHealthCase,
} from '../health-cases/healthCaseService';

import type { Observation, EpisodeOfCare } from 'fhir/r5';
import { formatDisplayDate } from '../../utils/dateUtils';
import { getEpisodeTitle, getEpisodeDescription } from '../../utils/fhirUtils';
import { COLORS } from '../../theme/colors';
import { PlusCircleButton } from '../../components/PlusCircleButton';
import { DeleteConfirmationModal } from '../../components/DeleteConfirmationModal';

export function HomeView() {
  const router = useRouter();
  const [records, setRecords] = useState<DiagnosticReportRecord[]>([]);
  const [healthCases, setHealthCases] = useState<EpisodeOfCare[]>([]);
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
    requireCountdown: true,
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
      console.error('Failed to load dashboard data:', err);
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

  const handleDeleteCaseClick = (id: string) => {
    setDeleteModal({
      visible: true,
      type: 'case',
      id,
      title: 'Delete Health Case',
      message:
        'Are you sure you want to delete this health case? This action cannot be undone.',
      requireCountdown: true,
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

  const getStatusBadge = (obs: Observation) => {
    const interpretationCode = obs.interpretation?.[0]?.coding?.[0]?.code;

    if (!interpretationCode) return null;

    let badgeText = 'Normal';
    let badgeStyle: any = styles.badgeNormal;
    let textStyle: any = styles.badgeTextNormal;

    if (interpretationCode === 'L') {
      badgeText = 'Low';
      badgeStyle = styles.badgeLow;
      textStyle = styles.badgeTextLow;
    } else if (interpretationCode === 'H') {
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
                  const title = getEpisodeTitle(caseItem);
                  const noteText = getEpisodeDescription(caseItem);
                  const caseId = caseItem.id || '';

                  return (
                    <View
                      key={caseId || 'case'}
                      style={styles.reportCard}
                      testID={`case-card-${caseId}`}
                    >
                      {/* Case Header: Status, Date & Action Icons */}
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderLeft}>
                          {getCaseStatusBadge(caseItem.status)}
                          <Calendar
                            color={COLORS.light.iconMuted}
                            size={16}
                            style={{ marginLeft: 8, marginRight: 6 }}
                          />
                          <Text style={styles.cardDate}>
                            {formatDate(caseItem.period?.start || '')}
                          </Text>
                        </View>
                        <View style={styles.cardHeaderActions}>
                          <TouchableOpacity
                            testID={`edit-case-button-${caseId}`}
                            style={styles.editReportButton}
                            onPress={() => {
                              if (
                                Platform.OS === 'web' &&
                                typeof document !== 'undefined'
                              ) {
                                (
                                  document.activeElement as HTMLElement
                                )?.blur?.();
                              }
                              router.push(`/health-case/${caseId}/edit`);
                            }}
                            activeOpacity={0.7}
                          >
                            <Pencil color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            testID={`delete-case-button-${caseId}`}
                            style={styles.deleteReportButton}
                            onPress={() => handleDeleteCaseClick(caseId)}
                            activeOpacity={0.7}
                          >
                            <Trash2 color={COLORS.light.iconMuted} size={18} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Case Title */}
                      <View style={styles.caseTitleContainer}>
                        <Text style={styles.caseTitleText}>{title}</Text>
                      </View>

                      {/* Notes / Description if available */}
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

            {/* Diagnostic Reports Section */}
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
                        {record.observations.map((obs) => {
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
                            <View key={obs.id} style={styles.obsItem}>
                              <View style={styles.obsLeft}>
                                <Text style={styles.obsName}>{name}</Text>
                                {obs.code?.coding?.[0]?.code &&
                                  obs.code?.coding?.[0]?.code !== 'custom' && (
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
                router.push('/lab-result/add');
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
    paddingBottom: 90,
  },
  sectionContainer: {
    marginBottom: 16,
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
  caseStatusBadge: {
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
  caseStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  caseTitleContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  caseTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
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
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  floatingButton: {
    shadowColor: COLORS.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  floatingMenuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.light.modalBackdrop,
    zIndex: 90,
  },
  floatingMenu: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    paddingVertical: 6,
    width: 200,
    zIndex: 95,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebModalCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  menuDivider: {
    height: 1,
    backgroundColor: COLORS.light.border,
  },
});
