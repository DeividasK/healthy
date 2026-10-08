import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileForm } from './ProfileForm';
import {
  getPatient,
  getStoredPatient,
  createOrUpdatePatient,
  deletePatient,
  getPatientDisplayName,
} from './patientService';
import { useActivePatient } from './ActivePatientContext';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useSync } from '@/src/context/SyncContext';
import {
  loadGoogleDriveConfig,
  deletePatientFromGoogleDrive,
} from '@/src/services/syncManager';
import { COLORS } from '@/src/theme/colors';

export function EditProfileView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshPatients, setActivePatientId } = useActivePatient();
  const { triggerSync } = useSync();
  const [initialValues, setInitialValues] = useState<{
    id: string;
    givenName: string;
    familyName?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
  } | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [isGoogleSynced, setIsGoogleSynced] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    (async () => {
      try {
        const patient = await getPatient(id);
        const stored = await getStoredPatient(id);
        if (!isMounted) return;
        if (!patient) {
          setNotFound(true);
          return;
        }

        const givenName = patient.name?.[0]?.given?.[0] || 'Self';
        const familyName = patient.name?.[0]?.family || undefined;
        setPatientName(getPatientDisplayName(patient));
        setIsGoogleSynced(Boolean(stored?.syncAccount));

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

  if (notFound || !initialValues || !id) {
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
    triggerSync().catch((err) =>
      console.warn('Background sync failed on profile edit:', err)
    );
  };

  const handleConfirmDelete = async (options?: {
    deleteFromCloud?: boolean;
  }) => {
    try {
      setShowDeleteModal(false);

      if (options?.deleteFromCloud && isGoogleSynced) {
        try {
          const googleConfig = await loadGoogleDriveConfig();
          if (googleConfig) {
            await deletePatientFromGoogleDrive(googleConfig, id);
          }
        } catch (cloudErr) {
          console.warn('Failed to delete patient from Google Drive:', cloudErr);
        }
      }

      const { remainingCount, newActiveId } = await deletePatient(id);
      await refreshPatients();
      if (newActiveId) {
        await setActivePatientId(newActiveId);
      }
      triggerSync().catch((err) =>
        console.warn('Background sync failed after profile deletion:', err)
      );

      if (remainingCount === 0) {
        router.replace('/profile/new');
      } else {
        router.replace('/profile');
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  };

  return (
    <>
      <ProfileForm
        isEdit
        initialValues={initialValues}
        onSave={handleSave}
        onDelete={() => setShowDeleteModal(true)}
      />

      <DeleteConfirmationModal
        visible={showDeleteModal}
        title="Delete Profile"
        message={`Are you sure you want to delete ${patientName || 'this profile'}? All associated lab results and conditions will be permanently removed.`}
        requireCountdown={true}
        countdownDuration={5}
        showCloudDeleteOption={isGoogleSynced}
        cloudDeleteLabel="Delete from Google Drive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
        testID="delete-profile-modal"
      />
    </>
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
