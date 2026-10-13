import { getConditionCategoryLabel } from './conditionCategories';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ConditionForm, ConditionFormValues } from './ConditionForm';
import {
  getConditionById,
  createOrUpdateCondition,
  type ConditionInput,
  deleteCondition,
} from './conditionService';
import { getConditionTitle, getConditionNotes } from '@/src/utils/fhirUtils';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';

export function EditConditionView() {
  const { activePatientId, isLoading: isPatientLoading } = useActivePatient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { triggerSync } = useSync();
  const [initialValues, setInitialValues] =
    useState<ConditionFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!id || isPatientLoading || !activePatientId) return;

    let isMounted = true;
    (async () => {
      try {
        const condition = await getConditionById(id, activePatientId);
        if (!isMounted) return;
        if (!condition) {
          setNotFound(true);
          return;
        }

        setNotFound(false);
        const patientRef = condition.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);

        const dateStr = condition.onsetDateTime;
        let dateObj = new Date();
        if (dateStr) {
          const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        let abatementDateObj: Date | undefined = undefined;
        if (condition.abatementDateTime) {
          const [y, m, d] = condition.abatementDateTime
            .slice(0, 10)
            .split('-')
            .map(Number);
          abatementDateObj = new Date(y, m - 1, d);
        }

        const title = getConditionTitle(condition);
        const notesText = getConditionNotes(condition) || undefined;
        const clinicalStatus =
          condition.clinicalStatus?.coding?.[0]?.code || 'active';
        const verificationStatus =
          condition.verificationStatus?.coding?.[0]?.code || '';
        const severity = condition.severity?.coding?.[0]?.code;
        const bodySite = condition.bodySite?.[0]?.text;

        setInitialValues({
          id: condition.id,
          title,
          clinicalStatus,
          verificationStatus,
          category: getConditionCategoryLabel(condition.category?.[0]),
          onsetDate: dateObj,
          severity,
          bodySite,
          abatementDate: abatementDateObj,
          notes: notesText,
        });
      } catch (err) {
        console.error('Failed to load condition for edit:', err);
        if (isMounted) setNotFound(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id, activePatientId, isPatientLoading]);

  if (isLoading || isPatientLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  if (notFound || !initialValues) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Condition not found.</Text>
      </View>
    );
  }

  if (initialPatientId !== activePatientId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.light.primary} />
      </View>
    );
  }

  const handleSave = async (values: ConditionInput) => {
    await createOrUpdateCondition({
      ...values,
      id,
      patientId: activePatientId || initialPatientId,
    });
    triggerSync().catch((err) =>
      console.warn('Background sync failed on edit condition:', err)
    );
  };

  return (
    <ConditionForm
      isEdit
      initialValues={initialValues}
      onSave={handleSave}
      onDelete={async () => {
        if (!id) return;
        await deleteCondition(id);
        triggerSync().catch((error) =>
          console.warn('Background sync failed on delete condition:', error)
        );
        router.dismissTo('/');
      }}
    />
  );
}

const styles = StyleSheet.create({
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
});
