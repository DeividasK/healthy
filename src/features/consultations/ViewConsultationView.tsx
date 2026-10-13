import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import type { Condition, Encounter } from 'fhir/r5';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationById } from '@/src/features/consultations/consultationService';
import { getConditionById } from '@/src/features/conditions/conditionService';
import { formatDisplayDateTime } from '@/src/utils/dateUtils';
import {
  getConditionTitle,
  getConsultationConditionIds,
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
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);

  const loadData = useCallback(async () => {
    const generation = ++loadGeneration.current;
    if (!id || !activePatientId) return;
    try {
      const value = await getConsultationById(id, activePatientId);
      if (generation !== loadGeneration.current) return;
      if (!value) {
        setConsultation(null);
        setRelatedConditions([]);
        setNotFound(true);
        setHasLoadError(false);
        return;
      }
      const conditions = await Promise.all(
        getConsultationConditionIds(value).map((conditionId) =>
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
  useDatabaseSubscription(['consultations', 'conditions'], loadData);

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

      {relatedConditions.length > 0 && (
        <View style={styles.relatedSection}>
          <Text style={styles.sectionTitle}>
            {relatedConditions.length === 1 ? 'Condition' : 'Conditions'}
          </Text>
          {relatedConditions.map((relatedCondition, index) => (
            <TouchableOpacity
              key={relatedCondition.id}
              testID={
                index === 0
                  ? 'consultation-related-condition'
                  : `consultation-related-condition-${relatedCondition.id}`
              }
              accessibilityRole="button"
              accessibilityLabel={`View condition: ${getConditionTitle(relatedCondition)}`}
              style={styles.conditionRow}
              onPress={() =>
                relatedCondition.id &&
                router.dismissTo(`/condition/${relatedCondition.id}`)
              }
              activeOpacity={0.75}
            >
              <Text style={styles.conditionTitle}>
                {getConditionTitle(relatedCondition)}
              </Text>
              <ChevronRight color={COLORS.light.muted} size={18} />
            </TouchableOpacity>
          ))}
        </View>
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
