import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProfileForm } from './ProfileForm';
import {
  getPatient,
  createOrUpdatePatient,
  deletePatient,
  getPatientDisplayName,
  type PatientInput,
} from './patientService';
import { useActivePatient } from './ActivePatientContext';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { useSync } from '@/src/context/SyncContext';
import { COLORS } from '@/src/theme/colors';
import { LoadingView } from '@/src/components/LoadingView';

export function EditProfileView() {
  const router = useRouter();
  const { id, show } = useLocalSearchParams<{ id: string; show?: string }>();
  // Fields a notice asked the user to fill in, e.g. for lab result ranges.
  const showFields = (show?.split(',') ?? []).filter(
    (field): field is 'birthDate' | 'gender' =>
      field === 'birthDate' || field === 'gender'
  );
  const { refreshPatients, setActivePatientId } = useActivePatient();
  const { vaultState, syncedProfileIds, syncNow } = useSync();
  const [initialValues, setInitialValues] = useState<PatientInput | null>(null);
  const [patientName, setPatientName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(!id);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
        setPatientName(getPatientDisplayName(patient));

        setInitialValues({
          id: patient.id!,
          givenName,
          familyName,
          gender: patient.gender as any,
          birthDate: patient.birthDate,
          photo: patient.photo?.find((photo) => photo.data),
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
    return <LoadingView />;
  }

  if (notFound || !initialValues || !id) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Profile not found.</Text>
      </View>
    );
  }

  const handleSave = async (values: PatientInput) => {
    await createOrUpdatePatient({
      ...values,
      id,
    });
    await refreshPatients();
  };

  const isSyncConnected =
    vaultState === 'unlocked' && Boolean(id && syncedProfileIds.includes(id));

  const handleConfirmDelete = async (options?: {
    deleteFromCloud?: boolean;
  }) => {
    try {
      setShowDeleteModal(false);

      // Without the cloud option ticked the profile stays in Google Drive and
      // on other devices; ticked, the deletion syncs everywhere.
      const deleteEverywhere = isSyncConnected && options?.deleteFromCloud;
      // Upload recent edits before the profile leaves this device.
      if (isSyncConnected && !deleteEverywhere) await syncNow();
      const { remainingCount, newActiveId } = await deletePatient(id, {
        deviceOnly: !deleteEverywhere,
      });
      await refreshPatients();
      if (newActiveId) {
        await setActivePatientId(newActiveId);
      }

      if (remainingCount === 0) {
        router.replace('/welcome');
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
        showFields={showFields}
        onSave={handleSave}
        onDelete={() => setShowDeleteModal(true)}
      />

      <DeleteConfirmationModal
        visible={showDeleteModal}
        title="Delete Profile"
        message={
          isSyncConnected
            ? `Are you sure you want to delete ${patientName || 'this profile'} from this device? It stays in Google Drive and on your other devices unless you also delete it from Google Drive.`
            : `Are you sure you want to delete ${patientName || 'this profile'}? All associated lab results and conditions will be permanently removed.`
        }
        requireCountdown={true}
        countdownDuration={5}
        showCloudDeleteOption={isSyncConnected}
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
