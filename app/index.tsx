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
          <Text style={[styles.statusText, styles.statusTextNormal]}>Normal</Text>
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
            <ActivityIndicator size="large" color="#3d6450" />
          </View>
        ) : records.length === 0 ? (
          /* Empty State when no results yet */
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <FileText color="#3d6450" size={36} />
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
              <Plus color="#ffffff" size={18} style={{ marginRight: 6 }} />
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
                      <Calendar color="#414844" size={16} style={{ marginRight: 6 }} />
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
                      <Pencil color="#414844" size={18} />
                    </TouchableOpacity>
                  </View>

                  {/* Notes if available */}
                  {noteText && (
                    <View style={styles.cardNoteContainer}>
                      <Text style={styles.cardNoteText}>&quot;{noteText}&quot;</Text>
                    </View>
                  )}

                  {/* Divider */}
                  <View style={styles.cardDivider} />

                  {/* Observations Telemetry Rows */}
                  <View style={styles.observationsContainer}>
                    {record.observations.map((obs) => {
                      const markerName =
                        obs.code.coding?.[0]?.display || obs.code.text || 'Biomarker';
                      const value = obs.valueQuantity?.value;
                      const unit = obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
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
    backgroundColor: '#f9faf6',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9faf6',
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
    backgroundColor: '#d1e9cd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1c1a',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#414844',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3d6450',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  emptyAddButtonText: {
    color: '#ffffff',
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
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e3df',
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
      },
      default: {
        shadowColor: '#0f172a',
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
    color: '#1a1c1a',
  },
  editReportButton: {
    padding: 6,
    borderRadius: 8,
  },
  cardNoteContainer: {
    marginTop: 8,
    backgroundColor: '#f9faf6',
    padding: 8,
    borderRadius: 8,
  },
  cardNoteText: {
    fontSize: 13,
    color: '#414844',
    fontStyle: 'italic',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#eeeeeb',
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
    color: '#1a1c1a',
  },
  obsReference: {
    fontSize: 12,
    color: '#717973',
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
    color: '#1a1c1a',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  obsUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#414844',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusNormal: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  statusLow: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  statusHigh: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextNormal: {
    color: '#10B981',
  },
  statusTextLow: {
    color: '#3B82F6',
  },
  statusTextHigh: {
    color: '#EF4444',
  },
});
