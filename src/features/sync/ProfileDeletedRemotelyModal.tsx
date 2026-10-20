import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  CenteredModal,
  ModalActions,
  ModalButton,
} from '@/src/components/CenteredModal';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import { useSync, type ProfileDeletionChoice } from '@/src/context/SyncContext';
import { PatientIdText } from '@/src/features/profile/PatientIdText';
import { getAllPatients } from '@/src/features/profile/patientService';
import { COLORS } from '@/src/theme/colors';

/**
 * Asks what to do with a profile that another device deleted from Google
 * Drive while it is still on this device. It cannot be dismissed: the
 * profile does not sync until the user chooses.
 */
export function ProfileDeletedRemotelyModal() {
  const router = useRouter();
  const { vaultState, profileDeletionHolds, resolveProfileDeletion } =
    useSync();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profile =
    vaultState === 'unlocked' ? profileDeletionHolds[0] : undefined;
  if (!profile) return null;
  const name = profile.displayName || 'This profile';

  const resolve = async (choice: ProfileDeletionChoice) => {
    setConfirmingDelete(false);
    setIsResolving(true);
    setError(null);
    try {
      await resolveProfileDeletion(profile.patientId, choice);
      if (choice === 'delete' && (await getAllPatients()).length === 0)
        router.replace('/profile/new');
    } catch (err) {
      console.warn('Failed to resolve the profile deletion:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <>
      <CenteredModal
        visible={!confirmingDelete}
        title="Profile deleted from Google Drive"
        testID="profile-deleted-remotely-modal"
      >
        <Text style={styles.message} testID="profile-deleted-remotely-message">
          {name} was deleted from Google Drive on another device. Its records
          are still on this device. Choose what to do with them.
        </Text>
        <View style={styles.idRow}>
          <Text style={styles.idLabel}>Patient ID</Text>
          <PatientIdText
            id={profile.patientId}
            testID="profile-deleted-remotely-id"
            style={styles.idValue}
          />
        </View>
        {error && (
          <FormErrorBanner
            message={error}
            testID="profile-deleted-remotely-error"
          />
        )}
        <ModalActions stacked>
          <ModalButton
            testID="profile-deletion-delete-button"
            tone="destructive"
            label="Delete from this device"
            disabled={isResolving}
            onPress={() => setConfirmingDelete(true)}
          />
          <ModalButton
            testID="profile-deletion-restore-button"
            tone="primary"
            label="Restore to Google Drive"
            disabled={isResolving}
            onPress={() => resolve('restore')}
          />
          <ModalButton
            testID="profile-deletion-keep-local-button"
            label="Keep only on this device"
            disabled={isResolving}
            onPress={() => resolve('keep-local')}
          />
        </ModalActions>
      </CenteredModal>

      <DeleteConfirmationModal
        visible={confirmingDelete}
        title="Delete Profile"
        message={`Are you sure you want to delete ${name} from this device? All of its records will be permanently removed.`}
        focusCancel
        onConfirm={() => resolve('delete')}
        onCancel={() => setConfirmingDelete(false)}
        testID="confirm-delete-held-profile-modal"
      />
    </>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  idLabel: {
    flexShrink: 0,
    fontSize: 14,
    color: COLORS.light.muted,
  },
  idValue: {
    flexShrink: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
});
