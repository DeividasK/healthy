import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
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
  Download,
} from 'lucide-react-native';
import { useSync } from '../../context/SyncContext';
import {
  exportZipArchive,
  restoreFromZipBytes,
} from '../../services/zipArchiveService';
import { COLORS } from '../../theme/colors';

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
    isSyncing,
    lastSyncedAt,
    isUpToDate,
    isAuthExpired,
    syncNow,
    connectWithGoogle,
    disconnect,
  } = useSync();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
            const userInfo = await res.json();
            if (!isMounted) return;
            await connectWithGoogle({
              accessToken,
              tokenExpiresAt,
              userSub: userInfo.sub || 'user-default-sub',
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
  }, [response, connectWithGoogle]);

  const handleExportZip = async () => {
    try {
      setActionLoading('export-zip');
      const res = await exportZipArchive();
      setFeedbackMessage(`Zip exported successfully (${res.fileName})!`);
    } catch (err) {
      Alert.alert(
        'Export Failed',
        err instanceof Error ? err.message : 'Failed to export Zip archive.'
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setActionLoading('restore-zip');
      const arrayBuffer = await file.arrayBuffer();
      const zipBytes = new Uint8Array(arrayBuffer);
      const res = await restoreFromZipBytes(zipBytes);
      setFeedbackMessage(
        `Restored from Zip: ${res.patients} profiles, ${res.reports} reports, ${res.conditions} conditions!`
      );
    } catch (err) {
      Alert.alert(
        'Restore Failed',
        err instanceof Error
          ? err.message
          : 'Failed to restore from Zip archive.'
      );
    } finally {
      setActionLoading(null);
      if (e.target) {
        e.target.value = '';
      }
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

  return (
    <View style={styles.container} testID="google-sync-card">
      {/* Hidden file input for Zip restore */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          id="restore-zip-file-input"
          name="restore-zip-file-input"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
        />
      )}

      {/* Cloud Backup Section */}
      <View style={styles.divider} />
      <View style={styles.sectionHeader}>
        <Cloud size={20} color={COLORS.light.primary} />
        <Text style={styles.sectionTitle}>Cloud Backup</Text>
      </View>

      {!config ? (
        // State A: Disconnected (1-Click Google Sign In)
        <View style={styles.disconnectedSection}>
          <Text style={styles.description}>
            Sync your encrypted records across devices using your private Google
            Drive AppData folder. Records are encrypted client-side with AES-256
            before syncing.
          </Text>

          <TouchableOpacity
            testID="google-signin-button"
            style={styles.googleBtn}
            disabled={!request || actionLoading === 'connecting'}
            onPress={() => promptAsync()}
            activeOpacity={0.8}
          >
            {actionLoading === 'connecting' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Cloud size={18} color="#fff" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        // State B: Connected
        <View style={styles.connectedSection}>
          <View style={styles.accountInfoBlock}>
            <Text
              style={styles.accountEmail}
              testID="connected-user-email"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {config.userEmail || 'Google Account Connected'}
            </Text>
            <Text style={styles.lastSyncedText} testID="last-synced-time-text">
              Last synced: {formatLastSynced()}
            </Text>
          </View>

          {/* Sync Now / Up to date / Reconnect Action Button */}
          {isAuthExpired ? (
            <TouchableOpacity
              testID="reconnect-google-button"
              style={[styles.syncButton, styles.syncButtonExpired]}
              disabled={!request || actionLoading === 'connecting'}
              onPress={() => promptAsync()}
              activeOpacity={0.8}
            >
              {actionLoading === 'connecting' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <RefreshCw size={16} color="#fff" />
                  <Text style={styles.syncButtonText}>Reconnect Google</Text>
                </>
              )}
            </TouchableOpacity>
          ) : isUpToDate && !isSyncing ? (
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
              disabled={isSyncing}
              onPress={syncNow}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.syncButtonText}>Syncing...</Text>
                </>
              ) : (
                <>
                  <RefreshCw size={16} color="#fff" />
                  <Text style={styles.syncButtonText}>Sync Now</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Disconnect Button below Sync Now */}
          <TouchableOpacity
            testID="disconnect-sync-button"
            style={styles.disconnectBtn}
            onPress={disconnect}
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
        <Text style={styles.sectionTitle}>Local Zip Backup (Unencrypted)</Text>
      </View>
      <Text style={styles.description}>
        Export or restore standard unencrypted JSON backups directly to or from
        your device without using Google Drive.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          testID="export-zip-button"
          style={styles.regularButton}
          disabled={actionLoading !== null}
          onPress={handleExportZip}
          activeOpacity={0.7}
        >
          <Archive size={16} color={COLORS.light.foreground} />
          <Text style={styles.regularButtonText}>Export Zip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="restore-zip-button"
          style={styles.regularButton}
          disabled={actionLoading !== null}
          onPress={() => {
            if (Platform.OS === 'web' && fileInputRef.current) {
              fileInputRef.current.click();
            } else {
              Alert.alert(
                'Notice',
                'Zip restore is available via browser file upload.'
              );
            }
          }}
          activeOpacity={0.7}
        >
          <Download size={16} color={COLORS.light.foreground} />
          <Text style={styles.regularButtonText}>Restore from Zip</Text>
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
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  disconnectedSection: {
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: COLORS.light.muted,
    lineHeight: 20,
    marginBottom: 14,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4285F4',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  connectedSection: {
    marginTop: 4,
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
  syncButtonDisabled: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  syncButtonExpired: {
    backgroundColor: '#D97706',
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
