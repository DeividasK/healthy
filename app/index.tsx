import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, FileText, Pencil, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
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
import { DiagnosticReportRecord } from '../src/database/types';
import { getAllReports } from '../src/services/diagnosticReportService';
import { FHIRObservation } from '../src/types/fhir';
import { formatDisplayDate } from '../src/utils/dateUtils';
import { COLORS } from '../src/theme/colors';

export default function HomeScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<DiagnosticReportRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllReports();
      setRecords(data);
    } catch (err) {
      console.error('Failed to load diagnostic reports:', err);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.light.primary} />
          </View>
        ) : records.length === 0 ? (
          /* Empty State when no results yet */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FileText color={COLORS.light.primary} size={36} />
            </View>
            <Text style={styles.emptyTitle}>No Results Yet</Text>
            <Text style={styles.emptySubtitle}>
              Track changes to your biomarkers over time by adding test results.
            </Text>
            <TouchableOpacity
              testID="add-results-button"
              style={styles.emptyAddButton}
              onPress={() => navigateToAddReport()}
              activeOpacity={0.8}
            >
              <Plus
                color={COLORS.light.primaryForeground}
                size={18}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.emptyAddButtonText}>Add results</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Results (Only) View */
          <ScrollView
            testID="results-scroll-view"
            style={styles.scrollList}
            contentContainerStyle={styles.scrollListContent}
          >
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
                  {/* Card Header: Date & Report Code */}
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
                    <TouchableOpacity
                      testID={`edit-report-button-${record.report.id}`}
                      style={styles.editReportButton}
                      onPress={() => navigateToAddReport(record.report.id)}
                      activeOpacity={0.7}
                    >
                      <Pencil color={COLORS.light.iconMuted} size={18} />
                    </TouchableOpacity>
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
                            {refLow !== undefined && refHigh !== undefined && (
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
          </ScrollView>
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
    backgroundColor: COLORS.light.background,
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
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  emptyAddButtonText: {
    color: COLORS.light.primaryForeground,
    fontSize: 15,
    fontWeight: '700',
  },
  scrollList: {
    flex: 1,
  },
  scrollListContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
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
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  editReportButton: {
    padding: 6,
    borderRadius: 8,
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
});
