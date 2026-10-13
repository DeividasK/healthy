import { getConditionCategoryLabel } from './conditionCategories';
import {
  CONDITION_STATUS_OPTIONS,
  VERIFICATION_OPTIONS,
} from './ConditionForm';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Calendar,
  ChevronRight,
  MapPin,
  Stethoscope,
  User,
} from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
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
import { getConditionById } from './conditionService';
import type { Condition, Encounter } from 'fhir/r5';

export function ViewConditionView() {
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [condition, setCondition] = useState<Condition | null>(null);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const loadSequence = useRef(0);
  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || isPatientLoading || !activePatientId) return;
    try {
      const [conditionData, consultationData] = await Promise.all([
        getConditionById(id, activePatientId),
        getConsultationsByConditionId(id),
      ]);
      if (sequence !== loadSequence.current) return;
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
      if (sequence !== loadSequence.current) return;
      console.error('Failed to load condition view data:', error);
      setHasLoadError(true);
    } finally {
      if (sequence === loadSequence.current) setIsLoading(false);
    }
  }, [id, activePatientId, isPatientLoading]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(['conditions', 'consultations'], loadData);

  const getStatus = (value: Condition) => {
    const clinicalStatus = value.clinicalStatus?.coding?.[0]?.code;
    const option = CONDITION_STATUS_OPTIONS.find(
      (item) => item.id === clinicalStatus
    );
    return {
      label: option?.label || clinicalStatus || 'Unknown',
      color: option?.dotColor || '#6B7280',
    };
  };

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
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="condition-add-menu"
            options={[
              {
                id: 'consultation',
                label: 'Add Consultation',
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
            ]}
          />
          <ResourceActionDock
            editLabel="Edit condition"
            onEdit={() => {
              setShowAddMenu(false);
              router.push(`/condition/${id}/edit`);
            }}
            onAdd={() => setShowAddMenu((visible) => !visible)}
            addLabel="Add consultation"
            addMenuExpanded={showAddMenu}
            editTestID="edit-condition-button"
            addTestID="condition-add-button"
          />
        </>
      }
    >
      <View style={styles.details}>
        {condition.verificationStatus && (
          <Text style={styles.notes} testID="condition-verification-status">
            Verification status:{' '}
            {VERIFICATION_OPTIONS.find(
              (item) =>
                item.id === condition.verificationStatus?.coding?.[0]?.code
            )?.label ||
              condition.verificationStatus.text ||
              condition.verificationStatus.coding?.[0]?.display ||
              condition.verificationStatus.coding?.[0]?.code}
          </Text>
        )}
        {condition.category?.map((category, index) => (
          <Text
            key={index}
            style={styles.notes}
            testID={`condition-category-${index}`}
          >
            Category: {getConditionCategoryLabel(category)}
          </Text>
        ))}
      </View>
      {condition.code?.coding?.map((coding, index) => (
        <View
          key={index}
          style={styles.details}
          testID={`condition-terminology-${index}`}
        >
          {coding.system && (
            <Text style={styles.notes}>
              Terminology System: {coding.system}
            </Text>
          )}
          {coding.code && (
            <Text style={styles.notes}>Diagnosis Code: {coding.code}</Text>
          )}
          {coding.display && (
            <Text style={styles.notes}>
              Terminology Display: {coding.display}
            </Text>
          )}
        </View>
      ))}
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
        style={[
          styles.consultationsSection,
          consultations.length > 0 && styles.consultationsList,
        ]}
        testID="condition-consultations-section"
      >
        <View style={styles.sectionHeading}>
          <Stethoscope size={18} color={COLORS.light.primary} />
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Recent Consultations
          </Text>
        </View>
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
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  consultationsList: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
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
