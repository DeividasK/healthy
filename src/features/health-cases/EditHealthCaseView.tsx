import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { HealthCaseForm, HealthCaseFormValues } from './HealthCaseForm';
import {
  getHealthCaseById,
  createOrUpdateHealthCase,
} from './healthCaseService';
import { COLORS } from '../../theme/colors';

export function EditHealthCaseView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initialValues, setInitialValues] =
    useState<HealthCaseFormValues | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    (async () => {
      try {
        const episode = await getHealthCaseById(id);
        if (!isMounted) return;
        if (!episode) {
          setNotFound(true);
          return;
        }

        const dateStr = episode.period?.start;
        let dateObj = new Date();
        if (dateStr) {
          const [y, m, d] = dateStr.split('-').map(Number);
          dateObj = new Date(y, m - 1, d);
        }

        const title =
          episode.type?.[0]?.text ||
          episode.diagnosis?.[0]?.condition?.[0]?.concept?.text ||
          episode.diagnosis?.[0]?.condition?.[0]?.reference?.display ||
          (episode.diagnosis?.[0] as any)?.condition?.display ||
          (episode as any).description ||
          '';

        const descText =
          ((episode as any).note && (episode as any).note.length > 0
            ? (episode as any).note.map((n: any) => n.text).join('\n')
            : undefined) ||
          (episode.text?.div
            ? episode.text.div.replace(/^<div[^>]*>|<\/div>$/gi, '')
            : undefined) ||
          (episode as any).description ||
          undefined;

        setInitialValues({
          id: episode.id,
          title,
          status: episode.status,
          startDate: dateObj,
          description: descText,
        });
      } catch (err) {
        console.error('Failed to load health case for edit:', err);
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
        <Text style={styles.errorText}>Health case not found.</Text>
      </View>
    );
  }

  const handleSave = async (values: {
    id?: string;
    title: string;
    status: any;
    startDate: string;
    description?: string;
  }) => {
    await createOrUpdateHealthCase({
      ...values,
      id,
    });
  };

  return (
    <HealthCaseForm isEdit initialValues={initialValues} onSave={handleSave} />
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
