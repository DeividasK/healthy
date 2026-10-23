import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Archive,
  Cloud,
  Download,
  Eye,
  KeyRound,
  LogOut,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react-native';
import { useSync } from '@/src/context/SyncContext';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { RecoveryPhraseModal } from '@/src/features/sync/RecoveryPhraseModal';
import { exportZipArchive } from '@/src/services/zipArchiveService';
import { COLORS } from '@/src/theme/colors';
import { useActivePatient } from './ActivePatientContext';
import { getPatientDisplayName } from './patientNames';
import { useGoogleAuthSignIn, GoogleAuthPayload } from './useGoogleAuthSignIn';
import { ProfileRow } from './ProfileRow';

// react-native-web colours the thumb of a switched-on Switch separately.
const webSwitchColors = { activeThumbColor: COLORS.light.card } as object;

function RowIconButton({
  icon: Icon,
  label,
  onPress,
  testID,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Icon size={18} color={COLORS.light.primary} />
    </TouchableOpacity>
  );
}

/**
 * The profile page's data rows: Google Drive backup with its switch, the
 * recovery phrase and export.
 */
export function ProfileBackupRows() {
  const router = useRouter();
  const {
    config,
    vaultState,
    syncState,
    isSyncing,
    isUpToDate,
    syncNow,
    connectWithGoogle,
    disconnect,
    syncedProfileIds,
    setProfileSynced,
  } = useSync();
  const { activePatient } = useActivePatient();
  const activeId = activePatient?.id;

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);

  const { signIn: promptGoogleSignIn, isReady: isGoogleReady } =
    useGoogleAuthSignIn(async (authData: GoogleAuthPayload) => {
      setActionLoading('connecting');
      try {
        const outcome = await connectWithGoogle(
          {
            accessToken: authData.accessToken,
            refreshToken: authData.refreshToken,
            tokenExpiresAt: authData.tokenExpiresAt,
            userSub: authData.userSub,
            userEmail: authData.userEmail,
            userName: authData.userName,
          },
          { syncPatientId: activeId }
        );
        router.push(
          outcome === 'created'
            ? '/sync/recovery-phrase'
            : `/sync/restore?profile=${activeId}`
        );
      } catch (err) {
        console.error('Google Drive connect failed:', err);
        Alert.alert('Error', 'Failed to connect Google Drive.');
      } finally {
        setActionLoading(null);
      }
    });

  // Sync is chosen per profile; the account may already sync other profiles.
  const isConnected =
    vaultState === 'unlocked' &&
    Boolean(activeId && syncedProfileIds.includes(activeId));

  const handleConnect = async () => {
    if (!activeId) return;
    if (vaultState === 'locked') {
      // Signed in to Google, but the recovery phrase was not entered yet.
      router.push(`/sync/restore?profile=${activeId}`);
      return;
    }
    if (vaultState === 'disconnected') {
      promptGoogleSignIn();
      return;
    }
    setActionLoading('connecting');
    try {
      await setProfileSynced(activeId, true);
    } catch (err) {
      console.error('Failed to sync profile:', err);
      Alert.alert('Error', 'Failed to connect this profile to Google Drive.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDisconnect = async (options?: {
    deleteFromCloud?: boolean;
  }) => {
    setShowDisconnectModal(false);
    if (!activeId) return;
    setActionLoading('disconnecting');
    try {
      await setProfileSynced(activeId, false, {
        deleteFromCloud: options?.deleteFromCloud,
      });
    } catch (err) {
      console.error('Failed to disconnect:', err);
      Alert.alert('Disconnect Failed', 'Failed to disconnect Google Drive.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLeaveAccount = async () => {
    setActionLoading('disconnecting');
    try {
      await disconnect();
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = async () => {
    try {
      setActionLoading('export');
      await exportZipArchive();
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Failed to export backup.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const isCurrentSyncing =
    isSyncing || syncState === 'syncing' || actionLoading === 'connecting';
  const isBusy =
    actionLoading === 'connecting' || actionLoading === 'disconnecting';
  const email = config?.userEmail;

  let status: string;
  if (isConnected)
    status = isCurrentSyncing
      ? 'syncing…'
      : isUpToDate
        ? 'up to date'
        : 'not synced yet';
  else if (vaultState === 'locked') status = 'enter your recovery phrase';
  else if (vaultState === 'unlocked') status = 'off for this profile';
  else status = 'Off · records are only on this device';

  const subtitle =
    vaultState === 'disconnected' ? (
      <Text testID="backup-status-text">{status}</Text>
    ) : (
      [
        <Text key="email" testID="connected-user-email">
          {email}
        </Text>,
        <Text key="status" testID="backup-status-text">
          {status}
        </Text>,
      ]
    );

  return (
    <>
      <ProfileRow
        testID={
          isConnected ? 'google-sync-connected' : 'google-sync-disconnected'
        }
        icon={Cloud}
        title="Google Drive backup"
        subtitle={subtitle}
        trailing={
          <>
            {isConnected && isCurrentSyncing && (
              <ActivityIndicator
                testID="backup-syncing-indicator"
                size="small"
                color={COLORS.light.primary}
                style={styles.spinner}
              />
            )}
            {isConnected && !isCurrentSyncing && !isUpToDate && (
              <RowIconButton
                testID="sync-now-button"
                icon={RefreshCw}
                label="Sync now"
                onPress={syncNow}
              />
            )}
            {vaultState === 'locked' && (
              // Signed in, but the phrase was never entered: allow leaving,
              // e.g. to use a different Google account.
              <RowIconButton
                testID="disconnect-locked-sync-button"
                icon={LogOut}
                label="Sign out of Google"
                onPress={handleLeaveAccount}
              />
            )}
            <Switch
              testID="backup-switch"
              accessibilityLabel="Google Drive backup"
              value={isConnected}
              disabled={
                isBusy ||
                !activeId ||
                (vaultState === 'disconnected' && !isGoogleReady)
              }
              onValueChange={(on) =>
                on ? handleConnect() : setShowDisconnectModal(true)
              }
              trackColor={{
                false: COLORS.light.pillBorder,
                true: COLORS.light.primary,
              }}
              thumbColor={COLORS.light.card}
              {...webSwitchColors}
            />
          </>
        }
      />
      {vaultState === 'unlocked' && (
        <ProfileRow
          testID="show-recovery-phrase-button"
          icon={KeyRound}
          title="Recovery phrase"
          accessibilityLabel="Show recovery phrase"
          onPress={() => setShowRecoveryPhrase(true)}
          trailing={<Eye size={18} color={COLORS.light.primary} />}
        />
      )}
      <ProfileRow
        testID="export-zip-button"
        icon={Archive}
        title="Export"
        accessibilityLabel="Export all profiles"
        onPress={handleExport}
        disabled={actionLoading === 'export'}
        trailing={
          actionLoading === 'export' ? (
            <ActivityIndicator size="small" color={COLORS.light.primary} />
          ) : (
            <Download size={18} color={COLORS.light.primary} />
          )
        }
      />

      <RecoveryPhraseModal
        visible={showRecoveryPhrase}
        onClose={() => setShowRecoveryPhrase(false)}
      />
      <DeleteConfirmationModal
        visible={showDisconnectModal}
        title="Disconnect Google Drive"
        message={`Stop syncing ${getPatientDisplayName(activePatient)} with Google Drive? The profile and its health records will remain safely on this device.`}
        confirmLabel="Disconnect"
        requireCountdown={false}
        showCloudDeleteOption={true}
        cloudDeleteLabel="Delete this profile from Google Drive"
        onConfirm={handleConfirmDisconnect}
        onCancel={() => setShowDisconnectModal(false)}
        testID="disconnect-confirmation-modal"
      />
    </>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginHorizontal: 8,
  },
});
