import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ConditionForm, ConditionFormValues } from './ConditionForm';
import { getConditionById, createOrUpdateCondition } from './conditionService';
import { getConditionTitle, getConditionNotes } from '@/src/utils/fhirUtils';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';

export function EditConditionView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { triggerSync } = useSync();
  const [initialValues, setInitialValues] =
    useState<ConditionFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  const [initialPatientId, setInitialPatientId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    (async () => {
      try {
        const condition = await getConditionById(id);
        if (!isMounted) return;
        if (!condition) {
          setNotFound(true);
          return;
        }

        const patientRef = condition.subject?.reference;
        const parsedPatientId = patientRef?.startsWith('Patient/')
          ? patientRef.replace('Patient/', '')
          : patientRef;
        setInitialPatientId(parsedPatientId);

        const dateStr = condition.onsetDateTime;
        let dateObj = new Date();
        if (dateStr) {
          const [y, m, d] = dateStr.split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        let abatementDateObj: Date | undefined = undefined;
        if (condition.abatementDateTime) {
          const [y, m, d] = condition.abatementDateTime.split('-').map(Number);
          abatementDateObj = new Date(y, m - 1, d);
        }

        const title = getConditionTitle(condition);
        const notesText = getConditionNotes(condition) || undefined;
        const clinicalStatus =
          condition.clinicalStatus?.coding?.[0]?.code || 'active';
        const verificationStatus =
          condition.verificationStatus?.coding?.[0]?.code || 'unconfirmed';
        const severity = condition.severity?.coding?.[0]?.code;
        const bodySite = condition.bodySite?.[0]?.text;

        setInitialValues({
          id: condition.id,
          title,
          clinicalStatus,
          verificationStatus,
          onsetDate: dateObj,
          severity,
          bodySite,
          abatementDate: abatementDateObj,
          notes: notesText,
        });
      } catch (err) {
        console.error('Failed to load condition for edit:', err);
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
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

  const handleSave = async (values: {
    id?: string;
    title: string;
    clinicalStatus: string;
    verificationStatus: string;
    onsetDate: string;
    severity?: string;
    bodySite?: string;
    abatementDate?: string;
    notes?: string;
  }) => {
    await createOrUpdateCondition({
      ...values,
      id,
      patientId: initialPatientId,
    });
    triggerSync().catch((err) =>
      console.warn('Background sync failed on edit condition:', err)
    );
  };

  return (
    <ConditionForm isEdit initialValues={initialValues} onSave={handleSave} />
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
