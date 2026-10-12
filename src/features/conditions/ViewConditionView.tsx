import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, ChevronRight, MapPin, User } from 'lucide-react-native';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useSync } from '@/src/context/SyncContext';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationsByConditionId } from '@/src/features/consultations/consultationService';
import {
  formatDisplayDate,
  formatDisplayDateTime,
} from '@/src/utils/dateUtils';
import {
  getConditionNotes,
  getConditionTitle,
  getConsultationDoctor,
  getConsultationNotes,
  getConsultationServiceType,
  getConsultationTitle,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { deleteCondition, getConditionById } from './conditionService';
import type { Condition, Encounter } from 'fhir/r5';

export function ViewConditionView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { triggerSync } = useSync();
  const [condition, setCondition] = useState<Condition | null>(null);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [conditionData, consultationData] = await Promise.all([
        getConditionById(id),
        getConsultationsByConditionId(id),
      ]);
      setHasLoadError(false);
      if (!conditionData) {
        setNotFound(true);
        setCondition(null);
        setConsultations([]);
      } else {
        setNotFound(false);
        setCondition(conditionData);
        setConsultations(consultationData);
      }
    } catch (error) {
      console.error('Failed to load condition view data:', error);
      setHasLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(['conditions', 'consultations'], loadData);

  const getStatus = (value: Condition) => {
    const clinicalStatus = value.clinicalStatus?.coding?.[0]?.code;
    const verificationStatus = value.verificationStatus?.coding?.[0]?.code;
    if (verificationStatus === 'unconfirmed')
      return { label: 'Unconfirmed', color: '#F59E0B' };
    if (verificationStatus === 'provisional')
      return { label: 'Provisional', color: '#3B82F6' };
    if (clinicalStatus === 'inactive')
      return { label: 'Inactive', color: '#6B7280' };
    if (clinicalStatus === 'remission')
      return { label: 'Remission', color: '#8B5CF6' };
    if (clinicalStatus === 'resolved')
      return { label: 'Resolved', color: '#717973' };
    return { label: 'Active', color: '#10B981' };
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteCondition(id);
      setDeleteModalVisible(false);
      triggerSync().catch((error) =>
        console.warn('Background sync failed on delete condition:', error)
      );
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } catch (error) {
      console.error('Failed to delete condition:', error);
    }
  };

  if (isLoading) {
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
  const status = getStatus(condition);
  const onsetDate = condition.onsetDateTime;
  const abatementDate = condition.abatementDateTime;
  const severity = condition.severity?.coding?.[0]?.code;
  const bodySite = condition.bodySite?.[0]?.text;

  return (
    <ResourceViewLayout
      testID="condition-view"
      title={title}
      titleTestID="condition-title"
      date={onsetDate ? formatDisplayDate(onsetDate) : undefined}
      status={status}
      actions={
        <ResourceActionDock
          deleteLabel="Delete condition"
          editLabel="Edit condition"
          onDelete={() => setDeleteModalVisible(true)}
          onEdit={() => router.push(`/condition/${id}/edit`)}
          onAdd={() => router.push(`/consultation/add?conditionId=${id}`)}
          addLabel="Add consultation"
          deleteTestID="delete-condition-button"
          editTestID="edit-condition-button"
          addTestID="add-consultation-to-condition-button"
        />
      }
      modal={
        <DeleteConfirmationModal
          visible={deleteModalVisible}
          title="Delete Condition"
          message="Are you sure you want to delete this condition? This action cannot be undone."
          requireCountdown
          onConfirm={handleDelete}
          onCancel={() => setDeleteModalVisible(false)}
        />
      }
    >
      {(severity || bodySite || abatementDate || notes) && (
        <View style={styles.details}>
          {(severity || bodySite || abatementDate) && (
            <View style={styles.detailMetaRow}>
              {severity && (
                <Text style={styles.metaText}>
                  Severity:{' '}
                  {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </Text>
              )}
              {bodySite && (
                <View style={styles.inlineMeta}>
                  <MapPin color={COLORS.light.muted} size={13} />
                  <Text style={styles.metaText}>{bodySite}</Text>
                </View>
              )}
              {abatementDate && (
                <Text style={styles.metaText}>
                  Resolved {formatDisplayDate(abatementDate)}
                </Text>
              )}
            </View>
          )}
          {notes && <Text style={styles.notes}>{notes}</Text>}
        </View>
      )}

      <View
        style={styles.consultationsSection}
        testID="condition-consultations-section"
      >
        <Text style={styles.sectionTitle}>Consultations</Text>
        {consultations.length ? (
          consultations.map((consultation) => {
            const consultationId = consultation.id || '';
            const date =
              consultation.actualPeriod?.start ||
              consultation.plannedStartDate ||
              '';
            const doctor = getConsultationDoctor(consultation);
            const serviceType = getConsultationServiceType(consultation);
            const consultationNotes = getConsultationNotes(consultation);
            return (
              <View key={consultationId} style={styles.consultationItem}>
                <TouchableOpacity
                  testID={`condition-consultation-item-${consultationId}`}
                  accessibilityRole="button"
                  accessibilityLabel={`View consultation: ${getConsultationTitle(consultation)}`}
                  style={styles.consultationRow}
                  activeOpacity={0.75}
                  onPress={() =>
                    router.push({
                      pathname: '/consultation/[id]',
                      params: { id: consultationId },
                    })
                  }
                >
                  <View style={styles.consultationMain}>
                    <Text style={styles.consultationTitle}>
                      {getConsultationTitle(consultation)}
                    </Text>
                    <View style={styles.consultationMeta}>
                      <View style={styles.inlineMeta}>
                        <Calendar color={COLORS.light.muted} size={14} />
                        <Text style={styles.metaText}>
                          {formatDisplayDateTime(date)}
                        </Text>
                      </View>
                      {doctor && (
                        <View style={styles.inlineMeta}>
                          <User color={COLORS.light.muted} size={14} />
                          <Text style={styles.metaText}>{doctor}</Text>
                        </View>
                      )}
                      {serviceType && (
                        <Text style={styles.metaText}>{serviceType}</Text>
                      )}
                    </View>
                  </View>
                  <ChevronRight color={COLORS.light.muted} size={18} />
                </TouchableOpacity>
                {consultationNotes && (
                  <Text style={styles.consultationNote}>
                    &quot;{consultationNotes}&quot;
                  </Text>
                )}
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText} testID="empty-consultations">
            No consultations associated with this condition yet.
          </Text>
        )}
      </View>
    </ResourceViewLayout>
  );
}

const styles = StyleSheet.create({
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: COLORS.light.mutedForeground,
  },
  details: {
    marginBottom: 26,
    gap: 10,
  },
  detailMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
  },
  notes: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.light.textSecondary,
  },
  consultationsSection: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  consultationRow: {
    minHeight: 60,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.dropdownSeparator,
    gap: 10,
  },
  consultationItem: {
    marginBottom: 16,
  },
  consultationMain: {
    flex: 1,
    gap: 5,
  },
  consultationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  consultationMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  consultationNote: {
    paddingTop: 8,
    paddingHorizontal: 1,
    fontSize: 12,
    lineHeight: 17,
    fontStyle: 'italic',
    color: COLORS.light.textSecondary,
  },
  emptyText: {
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.light.mutedForeground,
  },
});
