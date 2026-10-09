import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Pencil,
  Trash2,
  User,
} from 'lucide-react-native';
import { PlusCircleButton } from '@/src/components/PlusCircleButton';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import {
  getConditionTitle,
  getConditionNotes,
  getConsultationTitle,
  getConsultationDoctor,
  getConsultationServiceType,
  getConsultationNotes,
} from '@/src/utils/fhirUtils';
import { getConditionById, deleteCondition } from './conditionService';
import {
  getConsultationsByConditionId,
  deleteConsultation,
} from '@/src/features/consultations/consultationService';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';
import type { Condition, Encounter } from 'fhir/r5';

export function ViewConditionView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { triggerSync } = useSync();

  const [condition, setCondition] = useState<Condition | null>(null);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    type: 'condition' | 'consultation';
    id: string;
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'condition',
    id: '',
    title: '',
    message: '',
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [condData, consData] = await Promise.all([
        getConditionById(id),
        getConsultationsByConditionId(id),
      ]);
      if (!condData) {
        setNotFound(true);
        setCondition(null);
        setConsultations([]);
      } else {
        setNotFound(false);
        setCondition(condData);
        setConsultations(consData);
      }
    } catch (err) {
      console.error('Failed to load condition view data:', err);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useDatabaseSubscription(['conditions', 'consultations'], () => {
    loadData();
  });

  const handleDeleteConditionClick = () => {
    if (!id) return;
    setDeleteModal({
      visible: true,
      type: 'condition',
      id,
      title: 'Delete Condition',
      message:
        'Are you sure you want to delete this condition? This action cannot be undone.',
    });
  };

  const handleDeleteConsultationClick = (consId: string) => {
    setDeleteModal({
      visible: true,
      type: 'consultation',
      id: consId,
      title: 'Delete Consultation',
      message:
        'Are you sure you want to delete this consultation? This action cannot be undone.',
    });
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteModal.type === 'condition') {
        await deleteCondition(deleteModal.id);
        setDeleteModal((prev) => ({ ...prev, visible: false }));
        triggerSync().catch((err) =>
          console.warn('Background sync failed on delete condition:', err)
        );
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      } else {
        await deleteConsultation(deleteModal.id);
        setDeleteModal((prev) => ({ ...prev, visible: false }));
        triggerSync().catch((err) =>
          console.warn('Background sync failed on delete consultation:', err)
        );
        await loadData();
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const getConditionStatus = (cond: Condition) => {
    const clinicalStatus = cond.clinicalStatus?.coding?.[0]?.code;
    const verificationStatus = cond.verificationStatus?.coding?.[0]?.code;

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

    return { label, dot };
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !condition) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            testID="back-button"
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ArrowLeft color={COLORS.light.primaryForeground} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Condition</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Condition not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const condTitle = getConditionTitle(condition);
  const condNotes = getConditionNotes(condition);
  const statusInfo = getConditionStatus(condition);
  const onsetDate = condition.onsetDateTime;
  const abatementDate = condition.abatementDateTime;
  const severity = condition.severity?.coding?.[0]?.code;
  const bodySite = condition.bodySite?.[0]?.text;

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-button"
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/');
            }
          }}
          activeOpacity={0.7}
        >
          <ArrowLeft color={COLORS.light.primaryForeground} size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {condTitle || 'Condition'}
        </Text>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            testID="edit-condition-button"
            style={styles.headerActionBtn}
            onPress={() => router.push(`/condition/${id}/edit`)}
            activeOpacity={0.7}
          >
            <Pencil color={COLORS.light.primaryForeground} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="delete-condition-button"
            style={styles.headerActionBtn}
            onPress={handleDeleteConditionClick}
            activeOpacity={0.7}
          >
            <Trash2 color={COLORS.light.primaryForeground} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
      >
        {/* Condition Details Card */}
        <View style={styles.conditionCard}>
          {/* Card Header: Status & Onset Date */}
          <View style={styles.cardHeader}>
            <View style={styles.statusBadge}>
              <View
                style={[styles.statusDot, { backgroundColor: statusInfo.dot }]}
              />
              <Text style={styles.statusText}>{statusInfo.label}</Text>
            </View>

            {onsetDate && (
              <View style={styles.dateContainer}>
                <Calendar
                  color={COLORS.light.iconMuted}
                  size={16}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.cardDate}>
                  {formatDisplayDate(onsetDate)}
                </Text>
              </View>
            )}
          </View>

          {/* Condition Title */}
          <Text style={styles.conditionTitle} testID="condition-title">
            {condTitle}
          </Text>

          {/* Severity & Body Site Metadata */}
          {(severity || bodySite || abatementDate) && (
            <View style={styles.metaRow}>
              {severity && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    Severity:{' '}
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </Text>
                </View>
              )}
              {bodySite && (
                <View style={styles.metaPill}>
                  <MapPin
                    color={COLORS.light.iconMuted}
                    size={13}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={styles.metaPillText}>{bodySite}</Text>
                </View>
              )}
              {abatementDate && (
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillText}>
                    Resolved: {formatDisplayDate(abatementDate)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          {condNotes && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesText}>&quot;{condNotes}&quot;</Text>
            </View>
          )}
        </View>

        {/* Associated Consultations Section */}
        <View
          style={styles.consultationsSection}
          testID="condition-consultations-section"
        >
          <Text style={styles.sectionTitle}>Consultations</Text>
          {consultations.length > 0 ? (
            consultations.map((cons) => {
              const consId = cons.id || '';
              const consTitle = getConsultationTitle(cons);
              const doctor = getConsultationDoctor(cons);
              const serviceType = getConsultationServiceType(cons);
              const consNotesText = getConsultationNotes(cons);
              const dateStr =
                cons.actualPeriod?.start || cons.plannedStartDate || '';

              return (
                <View
                  key={consId}
                  style={styles.consultationCard}
                  testID={`condition-consultation-item-${consId}`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <Calendar
                        color={COLORS.light.iconMuted}
                        size={16}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.cardDate}>
                        {formatDisplayDateTime(dateStr)}
                      </Text>
                    </View>
                    <View style={styles.cardHeaderActions}>
                      <TouchableOpacity
                        testID={`edit-consultation-button-${consId}`}
                        style={styles.actionIconBtn}
                        onPress={() =>
                          router.push(`/consultation/${consId}/edit`)
                        }
                        activeOpacity={0.7}
                      >
                        <Pencil color={COLORS.light.iconMuted} size={18} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`delete-consultation-button-${consId}`}
                        style={styles.actionIconBtn}
                        onPress={() => handleDeleteConsultationClick(consId)}
                        activeOpacity={0.7}
                      >
                        <Trash2 color={COLORS.light.iconMuted} size={18} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.consultationTitleText}>{consTitle}</Text>

                  {serviceType && (
                    <View style={styles.serviceTypeBadge}>
                      <Text style={styles.serviceTypeText}>{serviceType}</Text>
                    </View>
                  )}

                  {doctor && (
                    <View style={styles.doctorRow}>
                      <User
                        color={COLORS.light.iconMuted}
                        size={14}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.doctorText}>{doctor}</Text>
                    </View>
                  )}

                  {consNotesText && (
                    <View style={styles.cardNoteContainer}>
                      <Text style={styles.cardNoteText}>
                        &quot;{consNotesText}&quot;
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View
              style={styles.emptyConsultationsContainer}
              testID="empty-consultations"
            >
              <Text style={styles.emptyConsultationsText}>
                No consultations associated with this condition yet.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Add Consultation Button at bottom middle (like in Home view) */}
      <View style={styles.floatingButtonContainer}>
        <PlusCircleButton
          testID="add-consultation-to-condition-button"
          variant="primary"
          onPress={() => router.push(`/consultation/add?conditionId=${id}`)}
          style={styles.floatingButton}
        />
      </View>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={deleteModal.visible}
        title={deleteModal.title}
        message={deleteModal.message}
        requireCountdown={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.background,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.light.textSecondary,
  },
  header: {
    backgroundColor: COLORS.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.primaryForeground,
    flex: 1,
    marginHorizontal: 12,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    padding: 4,
  },
  scrollContent: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  conditionCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
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
  statusBadge: {
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardDate: {
    fontSize: 13,
    color: COLORS.light.mutedForeground,
  },
  conditionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.light.foreground,
  },
  notesContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.divider,
  },
  notesText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.light.mutedForeground,
    lineHeight: 20,
  },
  consultationsSection: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 12,
  },
  consultationCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
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
  actionIconBtn: {
    padding: 6,
  },
  consultationTitleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
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
    marginTop: 2,
    marginBottom: 4,
  },
  doctorText: {
    fontSize: 13,
    color: COLORS.light.mutedForeground,
  },
  cardNoteContainer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.divider,
  },
  cardNoteText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: COLORS.light.mutedForeground,
  },
  emptyConsultationsContainer: {
    padding: 20,
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyConsultationsText: {
    fontSize: 14,
    color: COLORS.light.mutedForeground,
    textAlign: 'center',
  },
  floatingButtonContainer: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'box-none',
  },
  floatingButton: {
    ...Platform.select({
      web: {
        boxShadow: '0 4px 14px rgba(61, 100, 80, 0.35)',
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 8,
      },
    }),
  },
});
