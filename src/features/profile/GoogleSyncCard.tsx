import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Archive,
} from 'lucide-react-native';
import { useSync } from '../../context/SyncContext';
import { useActivePatient } from './ActivePatientContext';
import {
  getActivePatient,
  getStoredPatient,
  getAllStoredPatients,
  updatePatientSyncAccount,
  StoredPatient,
} from './patientService';
import { DeleteConfirmationModal } from '../../components/DeleteConfirmationModal';
import { deletePatientFromGoogleDrive } from '../../services/syncManager';
import { exportZipArchive } from '../../services/zipArchiveService';
import { COLORS } from '../../theme/colors';
import { useDatabaseSubscription } from '../../database/dbEvents';

WebBrowser.maybeCompleteAuthSession();

const googleDiscovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v3/userinfo',
};

export function GoogleSyncCard() {
  const {
    config,
    syncState,
    isSyncing,
    lastSyncedAt,
    isUpToDate,
    syncNow,
    connectWithGoogle,
    disconnect,
    triggerSync,
  } = useSync();
  const { activePatient, refreshPatients } = useActivePatient();

  const [activeStoredPatient, setActiveStoredPatient] =
    useState<StoredPatient | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const stored = activePatient?.id
        ? await getStoredPatient(activePatient.id)
        : null;
      if (isMounted) {
        setActiveStoredPatient(stored);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [activePatient]);

  useDatabaseSubscription(['patients'], () => {
    if (activePatient?.id) {
      getStoredPatient(activePatient.id).then((stored) => {
        setActiveStoredPatient(stored);
      });
    }
  });

  // Google OAuth setup
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'healthy',
    preferLocalhost: true,
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes: [
        'openid',
        'profile',
        'email',
        'https://www.googleapis.com/auth/drive.appdata',
      ],
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
      redirectUri,
    },
    googleDiscovery
  );

  useEffect(() => {
    let isMounted = true;
    if (response?.type === 'success') {
      const accessToken =
        response.authentication?.accessToken ||
        response.params.access_token ||
        '';

      const expiresInSeconds = response.authentication?.expiresIn
        ? Number(response.authentication.expiresIn)
        : response.params.expires_in
          ? Number(response.params.expires_in)
          : 3600;

      const tokenExpiresAt = Date.now() + expiresInSeconds * 1000;

      if (accessToken) {
        (async () => {
          if (!isMounted) return;
          setActionLoading('connecting');
          try {
            const res = await fetch(
              'https://www.googleapis.com/oauth2/v3/userinfo',
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!res.ok) {
              throw new Error(`Failed to fetch user info: HTTP ${res.status}`);
            }
            const userInfo = await res.json();
            if (!userInfo.sub) {
              throw new Error(
                'Google user info response did not contain a user ID (sub).'
              );
            }
            if (!isMounted) return;
            const userSub = userInfo.sub;

            const currActive = await getActivePatient();
            if (currActive?.id) {
              await updatePatientSyncAccount(currActive.id, userSub);
              await refreshPatients();
              const updated = await getStoredPatient(currActive.id);
              if (isMounted) {
                setActiveStoredPatient(updated);
              }
            }

            await connectWithGoogle({
              accessToken,
              tokenExpiresAt,
              userSub,
              userEmail: userInfo.email,
              userName: userInfo.name,
            });
            if (isMounted) {
              setFeedbackMessage(
                'Google Drive connected and initial sync started!'
              );
            }
          } catch (err) {
            console.error('Google profile fetch failed:', err);
            Alert.alert('Error', 'Failed to retrieve Google profile.');
          } finally {
            if (isMounted) {
              setActionLoading(null);
            }
          }
        })();
      }
    }

    return () => {
      isMounted = false;
    };
  }, [response, connectWithGoogle, refreshPatients]);

  const isProfileSynced = Boolean(
    config &&
    activeStoredPatient?.syncAccount &&
    activeStoredPatient.syncAccount === config.userSub
  );

  const handleConnectGoogleDrive = async () => {
    if (config) {
      if (activePatient?.id) {
        setActionLoading('connecting');
        try {
          await updatePatientSyncAccount(activePatient.id, config.userSub);
          const updated = await getStoredPatient(activePatient.id);
          setActiveStoredPatient(updated);
          await refreshPatients();
          setFeedbackMessage(
            'Google Drive connected to this profile and sync started!'
          );
          triggerSync().catch((syncErr) => {
            console.warn(
              'Initial sync after connect encountered error:',
              syncErr
            );
          });
        } catch (err) {
          console.error('Failed to link profile to Google Drive:', err);
          Alert.alert('Error', 'Failed to connect profile to Google Drive.');
        } finally {
          setActionLoading(null);
        }
      }
    } else {
      promptAsync();
    }
  };

  const handleConfirmDisconnect = async (options?: {
    deleteFromCloud?: boolean;
  }) => {
    setShowDisconnectModal(false);
    setActionLoading('disconnecting');
    try {
      if (!activePatient?.id) return;

      if (options?.deleteFromCloud && config) {
        try {
          await deletePatientFromGoogleDrive(config, activePatient.id);
        } catch (cloudErr) {
          console.warn(
            'Failed to delete patient data from Google Drive on disconnect:',
            cloudErr
          );
        }
      }

      await updatePatientSyncAccount(activePatient.id, null);
      const updated = await getStoredPatient(activePatient.id);
      setActiveStoredPatient(updated);
      await refreshPatients();

      // Check if any other profiles are still synced to this Google account
      if (config?.userSub) {
        const storedPatients = await getAllStoredPatients();
        const otherSynced = storedPatients.some(
          (sp) =>
            sp.patient.id !== activePatient.id &&
            sp.syncAccount === config.userSub
        );
        if (!otherSynced) {
          await disconnect();
        }
      }

      setFeedbackMessage(
        options?.deleteFromCloud
          ? 'Disconnected from Google Drive and cloud data deleted. Local records remain saved.'
          : 'Disconnected from Google Drive. Local records remain saved.'
      );
    } catch (err) {
      console.error('Failed to disconnect:', err);
      Alert.alert('Disconnect Failed', 'Failed to disconnect Google Drive.');
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

      {!isProfileSynced ? (
        // State A: Disconnected for this profile
        <View
          style={styles.disconnectedSection}
          testID="google-sync-disconnected"
        >
          <Text style={styles.description}>
            Sync your records safely across devices using your private Google
            Drive AppData folder, isolated from all other applications.
          </Text>

          <TouchableOpacity
            testID="google-signin-button"
            style={styles.googleBtn}
            disabled={(!request && !config) || actionLoading === 'connecting'}
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
        </View>
      ) : (
        // State B: Connected for this profile
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
        message="Are you sure you want to disconnect Google Drive? Your profile and health records will remain safely on this device."
        confirmLabel="Disconnect"
        requireCountdown={false}
        showCloudDeleteOption={true}
        cloudDeleteLabel="Delete data from Google Drive"
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
