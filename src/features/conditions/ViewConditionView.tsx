import { getConditionCategoryLabel } from './conditionCategories';
import { VERIFICATION_OPTIONS } from './ConditionForm';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { MapPin, Pill, Stethoscope } from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { ResourceTextSection } from '@/src/components/ResourceTextSection';
import { ResourceSection } from '@/src/components/ResourceSection';
import { ConsultationRelatedRow } from '@/src/features/consultations/ConsultationRelatedRow';
import { TreatmentRelatedRow } from '@/src/features/treatments/TreatmentRelatedRow';
import { getConditionMeta } from './ConditionRelatedRow';
import { ResourceViewLayout } from '@/src/components/ResourceViewLayout';
import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { useDatabaseSubscription } from '@/src/database/dbEvents';
import { getConsultationsByConditionId } from '@/src/features/consultations/consultationService';
import { getTreatmentsByConditionId } from '@/src/features/treatments/treatmentService';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { getConditionNotes, getConditionTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { deleteCondition, getConditionById } from './conditionService';
import { useSync } from '@/src/context/SyncContext';
import { goBackOr } from '@/src/utils/navigation';
import type { Condition, Encounter, MedicationRequest } from 'fhir/r5';

export function ViewConditionView() {
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { triggerSync } = useSync();
  const [condition, setCondition] = useState<Condition | null>(null);
  const [consultations, setConsultations] = useState<Encounter[]>([]);
  const [treatments, setTreatments] = useState<MedicationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const loadSequence = useRef(0);
  const loadData = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!id || isPatientLoading || !activePatientId) return;
    try {
      const [conditionData, consultationData, treatmentData] =
        await Promise.all([
          getConditionById(id, activePatientId),
          getConsultationsByConditionId(id),
          getTreatmentsByConditionId(id, activePatientId),
        ]);
      if (sequence !== loadSequence.current) return;
      setHasLoadError(false);
      if (!conditionData) {
        setNotFound(true);
        setCondition(null);
        setConsultations([]);
        setTreatments([]);
      } else {
        setNotFound(false);
        setCondition(conditionData);
        setConsultations(consultationData);
        setTreatments(treatmentData);
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
  useDatabaseSubscription(
    ['conditions', 'consultations', 'medication_requests'],
    loadData
  );

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
  const abatementDate = condition.abatementDateTime;
  const severity = condition.severity?.coding?.[0]?.code;
  const bodySite = condition.bodySite?.[0]?.text;

  return (
    <ResourceViewLayout
      testID="condition-view"
      title={title}
      titleTestID="condition-title"
      meta={getConditionMeta(condition)}
      actions={
        <>
          <FloatingAddMenu
            visible={showAddMenu}
            onClose={() => setShowAddMenu(false)}
            testID="condition-add-menu"
            options={[
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
                onPress: () =>
                  router.push({
                    pathname: '/consultation/add',
                    params: { conditionId: id },
                  }),
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
                onPress: () =>
                  router.push({
                    pathname: '/treatment/add',
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
            addLabel="Add record"
            addMenuExpanded={showAddMenu}
            editTestID="edit-condition-button"
            addTestID="condition-add-button"
            deleteLabel="Delete condition"
            deleteTestID="delete-condition-button"
            deleteConfirmation={{
              title: 'Delete Condition',
              message:
                'Are you sure you want to delete this condition? This action cannot be undone.',
              onConfirm: async () => {
                await deleteCondition(condition.id!);
                triggerSync().catch((error) =>
                  console.warn(
                    'Background sync failed on delete condition:',
                    error
                  )
                );
                goBackOr(router, '/');
              },
            }}
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
          {notes && (
            <ResourceTextSection
              title="Notes"
              text={notes}
              testID="condition-notes"
            />
          )}
        </View>
      )}

      <ResourceSection
        icon={Stethoscope}
        title="Recent Consultations"
        testID="condition-consultations-section"
        emptyText="No consultations associated with this condition yet."
        emptyTestID="empty-consultations"
      >
        {consultations.map((consultation) => (
          <ConsultationRelatedRow
            key={consultation.id}
            consultation={consultation}
            testID={`condition-consultation-item-${consultation.id}`}
            showNotes
            onPress={() =>
              router.push({
                pathname: '/consultation/[id]',
                params: { id: consultation.id! },
              })
            }
          />
        ))}
      </ResourceSection>

      {treatments.length > 0 && (
        <ResourceSection
          icon={Pill}
          title="Treatments"
          testID="condition-treatments-section"
        >
          {treatments.map((treatment) => (
            <TreatmentRelatedRow
              key={treatment.id}
              treatment={treatment}
              testID={`condition-treatment-item-${treatment.id}`}
              onPress={() =>
                router.push({
                  pathname: '/treatment/[id]',
                  params: { id: treatment.id! },
                })
              }
            />
          ))}
        </ResourceSection>
      )}
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
});
