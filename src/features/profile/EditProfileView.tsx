import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ProfileForm } from './ProfileForm';
import { getPatient, createOrUpdatePatient } from './patientService';
import { useActivePatient } from './ActivePatientContext';
import { COLORS } from '../../theme/colors';

export function EditProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshPatients } = useActivePatient();
  const [initialValues, setInitialValues] = useState<{
    id: string;
    givenName: string;
    familyName?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    (async () => {
      try {
        const patient = await getPatient(id);
        if (!isMounted) return;
        if (!patient) {
          setNotFound(true);
          return;
        }

        const givenName = patient.name?.[0]?.given?.[0] || 'Self';
        const familyName = patient.name?.[0]?.family || undefined;

        setInitialValues({
          id: patient.id!,
          givenName,
          familyName,
          gender: patient.gender as any,
          birthDate: patient.birthDate,
        });
      } catch (err) {
        console.error('Failed to load patient for edit:', err);
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
        <Text style={styles.errorText}>Profile not found.</Text>
      </View>
    );
  }

  const handleSave = async (values: {
    id?: string;
    givenName: string;
    familyName?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
  }) => {
    await createOrUpdatePatient({
      ...values,
      id,
    });
    await refreshPatients();
  };

  return (
    <ProfileForm isEdit initialValues={initialValues} onSave={handleSave} />
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
