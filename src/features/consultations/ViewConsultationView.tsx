import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { Condition, Encounter, MedicationRequest } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import { getLinkedTreatmentsForConsultation } from '@/src/features/treatments/treatmentService';
import { RelatedResourceList } from './RelatedResourceList';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConditionTitle,
  getConsultationConditionIds,
  getConsultationReasonConditionIds,
  getConsultationDoctor,
  getConsultationNotes,
  getConsultationServiceType,
  getConsultationTitle,
} from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';

export function ViewConsultationView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const loadGeneration = useRef(0);
  const [consultation, setConsultation] = useState<Encounter | null>(null);
  const [relatedConditions, setRelatedConditions] = useState<Condition[]>([]);
  const [linkedTreatments, setLinkedTreatments] = useState<MedicationRequest[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadData = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!id || !activePatientId) return;
    try {
      const [value, treatments] = await Promise.all([
        getConsultationById(id, activePatientId),
        getLinkedTreatmentsForConsultation(id, activePatientId).catch(() => []),
      ]);
      if (generation !== loadGeneration.current) return;
      if (!value) {
        setConsultation(null);
        setRelatedConditions([]);
        setLinkedTreatments([]);
        setNotFound(true);
        setHasLoadError(false);
        return;
      }
      const conditions = await Promise.all(
        [
          ...new Set([
            ...getConsultationConditionIds(value),
            ...getConsultationReasonConditionIds(value),
          ]),
        ].map((conditionId) =>
          getConditionById(conditionId).catch((error) => {
            console.warn('Failed to load related condition:', error);
            return null;
          })
        )
      );
      if (generation !== loadGeneration.current) return;
      setConsultation(value);
      setRelatedConditions(
        conditions.filter((condition): condition is Condition =>
          Boolean(condition)
        )
      );
      setLinkedTreatments(treatments);
      setNotFound(false);
      setHasLoadError(false);
    } catch (error) {
      console.error('Failed to load consultation view data:', error);
      if (generation === loadGeneration.current) setHasLoadError(true);
    } finally {
      if (generation === loadGeneration.current) setIsLoading(false);
    }
  }, [id, activePatientId]);

  useFocusEffect(useCallback(() => void loadData(), [loadData]));
  useDatabaseSubscription(
    [
      'consultations',
      'conditions',
      'medication_requests',
      'clinical_documents',
    ],
    loadData
  );

  if (isLoading) {
    return <ResourceViewLayout testID="consultation-view" isLoading />;
  }

  if (
    hasLoadError ||
    notFound ||
    !consultation ||
    consultation.subject?.reference !== `Patient/${activePatientId}`
  ) {
    return (
      <ResourceViewLayout
        testID="consultation-view"
        error={
          hasLoadError
            ? 'Failed to load consultation.'
            : 'Consultation not found.'
        }
      />
    );
  }

  const title = getConsultationTitle(consultation);
  const date =
    consultation.actualPeriod?.start || consultation.plannedStartDate || '';
  const doctor = getConsultationDoctor(consultation);
  const serviceType = getConsultationServiceType(consultation);
  const notes = getConsultationNotes(consultation);
  const status = consultation.status
    ? consultation.status.charAt(0).toUpperCase() + consultation.status.slice(1)
    : 'Unknown';

  return (
    <ResourceViewLayout
      testID="consultation-view"
      title={title}
      titleTestID="consultation-title"
      date={date ? formatDisplayDateTime(date) : undefined}
      status={{ label: status }}
      actions={
        <ResourceActionDock
          editLabel="Edit consultation"
          onEdit={() => router.push(`/consultation/${id}/edit`)}
          editTestID="edit-consultation-button"
        />
      }
    >
      {(doctor || serviceType || notes) && (
        <View style={styles.details}>
          {doctor && <InfoRow label="Practitioner" value={doctor} />}
          {serviceType && <InfoRow label="Service" value={serviceType} />}
          {notes && <Text style={styles.notes}>{notes}</Text>}
        </View>
      )}

      {getConsultationReasonConditionIds(consultation).length > 0 && (
        <View style={styles.relatedSection} testID="consultation-reasons">
          <Text style={styles.sectionTitle}>Reasons for visit</Text>
          {relatedConditions
            .filter((condition) =>
              getConsultationReasonConditionIds(consultation).includes(
                condition.id!
              )
            )
            .map((condition, index) => (
              <TouchableOpacity
                key={condition.id}
                testID={
                  index === 0
                    ? 'consultation-related-condition'
                    : `consultation-related-condition-${condition.id}`
                }
                accessibilityRole="button"
                accessibilityLabel={`View condition: ${getConditionTitle(condition)}`}
                style={styles.conditionRow}
                onPress={() => router.dismissTo(`/condition/${condition.id}`)}
              >
                <Text style={styles.conditionTitle}>
                  {getConditionTitle(condition)}
                </Text>
                <ChevronRight color={COLORS.light.muted} size={18} />
              </TouchableOpacity>
            ))}
        </View>
      )}
      {Boolean(consultation.diagnosis?.length) && (
        <View style={styles.relatedSection} testID="consultation-diagnoses">
          <Text style={styles.sectionTitle}>Diagnoses</Text>
          {consultation.diagnosis?.flatMap((diagnosis, index) =>
            (diagnosis.condition || []).map((value, valueIndex) => {
              const id = value.reference?.reference?.startsWith('Condition/')
                ? value.reference.reference.slice(10)
                : undefined;
              const condition = relatedConditions.find(
                (item) => item.id === id
              );
              const label =
                value.concept?.text ||
                value.concept?.coding?.[0]?.display ||
                (condition
                  ? getConditionTitle(condition)
                  : value.reference?.display);
              if (!label) return null;
              const contents = (
                <>
                  <Text style={styles.conditionTitle}>{label}</Text>
                  {value.concept?.coding?.map((coding, codingIndex) => (
                    <Text key={codingIndex} style={styles.notes}>
                      {[coding.system, coding.code, coding.display]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  ))}
                </>
              );
              return condition ? (
                <TouchableOpacity
                  key={`${index}-${valueIndex}`}
                  testID={
                    index === 0
                      ? 'consultation-diagnosis-condition'
                      : `consultation-diagnosis-condition-${id}`
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View condition: ${getConditionTitle(condition)}`}
                  style={styles.conditionRow}
                  onPress={() => router.dismissTo(`/condition/${id}`)}
                >
                  <View style={{ flex: 1 }}>{contents}</View>
                  <ChevronRight color={COLORS.light.muted} size={18} />
                </TouchableOpacity>
              ) : (
                <View
                  key={`${index}-${valueIndex}`}
                  testID={`consultation-diagnosis-${index}`}
                  style={styles.details}
                >
                  {contents}
                </View>
              );
            })
          )}
        </View>
      )}

      {Boolean(id) && (
        <RelatedResourceList
          consultationId={id!}
          linkedTreatments={linkedTreatments}
          onRefresh={loadData}
        />
      )}
    </ResourceViewLayout>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  details: {
    gap: 12,
    marginBottom: 28,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 20,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.light.mutedForeground,
  },
  infoValue: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    textAlign: 'right',
  },
  notes: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.light.textSecondary,
  },
  relatedSection: {
    marginTop: 2,
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  conditionRow: {
    minHeight: 52,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
    backgroundColor: COLORS.light.dropdownSeparator,
  },
  conditionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
});
