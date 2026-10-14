import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Archive,
  KeyRound,
} from 'lucide-react-native';
import { useSync } from '@/src/context/SyncContext';
import { useActivePatient } from './ActivePatientContext';
import { getPatientDisplayName } from './patientNames';
import { useGoogleAuthSignIn, GoogleAuthPayload } from './useGoogleAuthSignIn';
import { DeleteConfirmationModal } from '@/src/components/DeleteConfirmationModal';
import { exportZipArchive } from '@/src/services/zipArchiveService';
import { COLORS } from '@/src/theme/colors';

export function GoogleSyncCard() {
  const router = useRouter();
  const {
    config,
    vaultState,
    syncState,
    isSyncing,
    lastSyncedAt,
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
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Google OAuth Hook
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

  const handleConnectGoogleDrive = async () => {
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
      setFeedbackMessage(
        'Google Drive connected to this profile and sync started!'
      );
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
      setFeedbackMessage(
        options?.deleteFromCloud
          ? 'Stopped syncing this profile and deleted it from Google Drive. Local records remain saved.'
          : 'Stopped syncing this profile. Local records remain saved.'
      );
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

  const handleExportZip = async () => {
    try {
      setActionLoading('export-zip');
      const res = await exportZipArchive();
      setFeedbackMessage(`Exported successfully (${res.fileName})!`);
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Failed to export backup.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatLastSynced = () => {
    if (!lastSyncedAt) return 'Never';
    return (
      lastSyncedAt.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ', ' +
      lastSyncedAt.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
  };

  const isCurrentSyncing =
    isSyncing || syncState === 'syncing' || actionLoading === 'connecting';

  return (
    <View style={styles.container} testID="google-sync-card">
      {/* Cloud Backup Section */}
      <View style={styles.divider} />
      <View style={styles.sectionHeader}>
        <Cloud size={20} color={COLORS.light.primary} />
        <Text style={styles.sectionTitle}>Cloud Backup</Text>
      </View>

      {!isConnected ? (
        // State A: Not syncing on this device
        <View
          style={styles.disconnectedSection}
          testID="google-sync-disconnected"
        >
          <Text style={styles.description}>
            Sync this profile across your devices through your Google Drive.
            Records are end-to-end encrypted with a recovery phrase that only
            you hold.
          </Text>

          <TouchableOpacity
            testID="google-signin-button"
            style={styles.googleBtn}
            disabled={
              (!isGoogleReady && vaultState !== 'locked') ||
              actionLoading === 'connecting'
            }
            onPress={handleConnectGoogleDrive}
            activeOpacity={0.8}
          >
            {actionLoading === 'connecting' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Cloud size={18} color="#fff" />
                <Text style={styles.googleBtnText}>Connect Google Drive</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Signed in, but the recovery phrase was never entered: allow
              leaving, e.g. to use a different Google account. */}
          {vaultState === 'locked' && (
            <TouchableOpacity
              testID="disconnect-locked-sync-button"
              style={[styles.disconnectBtn, styles.lockedDisconnectBtn]}
              onPress={handleLeaveAccount}
              activeOpacity={0.7}
            >
              <LogOut size={15} color={COLORS.light.destructive} />
              <Text style={styles.disconnectBtnText}>
                Use a different Google account
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        // State B: Syncing on this device
        <View style={styles.connectedSection}>
          <View style={styles.accountInfoBlock}>
            <Text
              style={styles.accountEmail}
              testID="connected-user-email"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {config?.userEmail || 'Google Account Connected'}
            </Text>
            <Text style={styles.lastSyncedText} testID="last-synced-time-text">
              Last synced: {formatLastSynced()}
            </Text>
          </View>

          {/* Sync Now / Up to date Action Button */}
          {isCurrentSyncing ? (
            <TouchableOpacity
              testID="sync-now-button"
              style={[styles.syncButton, styles.syncButtonSyncing]}
              disabled={true}
            >
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.syncButtonText}>Syncing...</Text>
            </TouchableOpacity>
          ) : isUpToDate ? (
            <View
              testID="up-to-date-button"
              style={[styles.syncButton, styles.syncButtonDisabled]}
            >
              <CheckCircle2 size={16} color="#16A34A" />
              <Text style={styles.syncButtonTextUpToDate}>Up to date</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="sync-now-button"
              style={styles.syncButton}
              disabled={isCurrentSyncing}
              onPress={syncNow}
              activeOpacity={0.8}
            >
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.syncButtonText}>Sync Now</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            testID="show-recovery-phrase-button"
            style={[styles.regularButton, styles.recoveryPhraseButton]}
            onPress={() => router.push('/sync/recovery-phrase')}
            activeOpacity={0.7}
          >
            <KeyRound size={16} color={COLORS.light.foreground} />
            <Text style={styles.regularButtonText}>Show recovery phrase</Text>
          </TouchableOpacity>

          {/* Disconnect Button below Sync Now */}
          <TouchableOpacity
            testID="disconnect-sync-button"
            style={styles.disconnectBtn}
            onPress={() => setShowDisconnectModal(true)}
            activeOpacity={0.7}
          >
            <LogOut size={15} color={COLORS.light.destructive} />
            <Text style={styles.disconnectBtnText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Independent Local Zip Backup Section */}
      <View style={styles.divider} />
      <View style={styles.sectionHeader}>
        <Archive size={18} color={COLORS.light.primary} />
        <Text style={styles.sectionTitle}>Local Backup (Unencrypted)</Text>
      </View>
      <Text style={styles.description}>
        Export standard unencrypted JSON backups directly to your device without
        using Google Drive.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          testID="export-zip-button"
          style={styles.regularButton}
          disabled={actionLoading !== null}
          onPress={handleExportZip}
          activeOpacity={0.7}
        >
          {actionLoading === 'export-zip' ? (
            <ActivityIndicator size="small" color={COLORS.light.foreground} />
          ) : (
            <>
              <Archive size={16} color={COLORS.light.foreground} />
              <Text style={styles.regularButtonText}>Export</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <View style={styles.feedbackBox} testID="sync-feedback-toast">
          <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          <TouchableOpacity onPress={() => setFeedbackMessage(null)}>
            <Text style={styles.feedbackDismiss}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Disconnect Confirmation Modal */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light.border,
    marginVertical: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  description: {
    fontSize: 13,
    color: COLORS.light.muted,
    lineHeight: 18,
    marginBottom: 14,
  },
  disconnectedSection: {
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.light.border,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  connectedSection: {
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.light.border,
  },
  accountInfoBlock: {
    marginBottom: 14,
  },
  accountEmail: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  lastSyncedText: {
    fontSize: 13,
    color: COLORS.light.muted,
    marginTop: 2,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.light.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  syncButtonSyncing: {
    backgroundColor: '#9CA3AF',
  },
  syncButtonDisabled: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primaryForeground,
  },
  syncButtonTextUpToDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#16A34A',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 4,
  },
  lockedDisconnectBtn: {
    marginTop: 10,
    marginBottom: 0,
  },
  disconnectBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.destructive,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  regularButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
  },
  recoveryPhraseButton: {
    flex: 0,
    marginBottom: 10,
  },
  regularButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  feedbackText: {
    fontSize: 13,
    color: '#166534',
    flex: 1,
  },
  feedbackDismiss: {
    fontSize: 14,
    color: '#166534',
    paddingHorizontal: 6,
  },
});
