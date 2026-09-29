import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  useColorScheme,
  Platform,
} from 'react-native';
import { useAuthRequest, ResponseType } from 'expo-auth-session';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  Upload,
  Download,
  Database,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Key,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Layers,
  History,
  Copy,
} from 'lucide-react-native';
import { useLabReports } from '../../src/context/LabReportsContext';
import {
  getGoogleAuthState,
  signOutGoogle,
  saveGoogleAuthState,
  fetchGoogleUserProfile,
  enableMockGoogleAccount,
  getGoogleClientConfig,
  saveGoogleClientConfig,
  getActiveClientId,
  getGoogleRedirectUri,
  GOOGLE_DISCOVERY,
  GOOGLE_DRIVE_SCOPES,
  GoogleAuthState,
  GoogleClientConfig,
} from '../../src/services/googleAuth';
import {
  findDatabaseFile,
  DriveFileInfo,
  DEFAULT_DATABASE_FILENAME,
} from '../../src/services/googleDrive';
import {
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  subscribeToSyncStatus,
  SyncStatus,
} from '../../src/services/syncEngine';
import {
  getSyncAuditLogs,
  getDeviceId,
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
} from '../../src/database/db';
import { SyncAuditEntry } from '../../src/database/types';
import { useLanguage } from '../../src/i18n';

export default function GoogleDriveSyncScreen() {
  const { t } = useLanguage();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { versionInfo, refreshReports, triggerSync } = useLabReports();

  // Auth State
  const [authState, setAuthState] = useState<GoogleAuthState>({
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    user: null,
  });

  // Client Config
  const [clientConfig, setClientConfig] = useState<GoogleClientConfig>({
    clientIdWeb: '',
    clientIdIos: '',
    clientIdAndroid: '',
  });
  const [showConfig, setShowConfig] = useState(false);
  const [activeClientId, setActiveClientId] = useState('');

  // Sync state & files
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'idle',
    lastSyncTime: null,
    lastResult: null,
    error: null,
  });
  const [autoSync, setAutoSync] = useState(true);
  const [driveFile, setDriveFile] = useState<DriveFileInfo | null>(null);
  const [auditLogs, setAuditLogs] = useState<SyncAuditEntry[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [showMigrations, setShowMigrations] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Setup expo-auth-session request
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: activeClientId || 'google-client-id-placeholder',
      responseType: ResponseType.Token,
      scopes: GOOGLE_DRIVE_SCOPES,
      redirectUri: getGoogleRedirectUri(),
    },
    GOOGLE_DISCOVERY
  );

  // Load auth state and configuration on mount
  const reloadState = useCallback(async () => {
    const auth = await getGoogleAuthState();
    setAuthState(auth);

    const config = await getGoogleClientConfig();
    setClientConfig(config);

    const currentId = await getActiveClientId();
    setActiveClientId(currentId);

    const autoSyncActive = await isAutoSyncEnabled();
    setAutoSync(autoSyncActive);

    const dId = await getDeviceId();
    setDeviceId(dId);

    const logs = await getSyncAuditLogs(10);
    setAuditLogs(logs);

    if (auth.isAuthenticated) {
      checkDriveFile();
    }
  }, []);

  useEffect(() => {
    reloadState();

    const unsubscribe = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
      if (status.state === 'success') {
        checkDriveFile();
        getSyncAuditLogs(10).then(setAuditLogs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [reloadState]);

  // Handle OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token, expires_in } = response.params;
      const expiresInSec = expires_in ? parseInt(expires_in, 10) : 3600;

      fetchGoogleUserProfile(access_token).then(async (user) => {
        const newState: GoogleAuthState = {
          isAuthenticated: true,
          accessToken: access_token,
          refreshToken: null,
          expiresAt: Date.now() + expiresInSec * 1000,
          user,
        };
        await saveGoogleAuthState(newState);
        setAuthState(newState);
        Alert.alert('Google Connected', `Signed in as ${user?.name || user?.email || 'User'}`);
        checkDriveFile();
      });
    } else if (response?.type === 'error') {
      Alert.alert('Google Sign-In Error', response.error?.message || 'Authentication failed');
    }
  }, [response]);

  const checkDriveFile = async () => {
    try {
      setIsLoadingFile(true);
      const file = await findDatabaseFile(DEFAULT_DATABASE_FILENAME);
      setDriveFile(file);
    } catch {
      setDriveFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  };

  const handleSignIn = async () => {
    if (!activeClientId) {
      Alert.alert(
        'Google Client ID Required',
        'To connect your personal Google Drive, please enter your Google OAuth Client ID in the Configuration section below, or tap "Use Demo Account" to test the sync feature immediately.',
        [
          { text: 'Use Demo Account', onPress: handleUseDemoAccount },
          { text: 'Configure Client ID', onPress: () => setShowConfig(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      await promptAsync();
    } catch (err: any) {
      Alert.alert('Sign-In Error', err?.message || 'Failed to start Google Sign-In');
    }
  };

  const handleUseDemoAccount = async () => {
    const mockAuth = await enableMockGoogleAccount();
    setAuthState(mockAuth);
    await checkDriveFile();
    Alert.alert(
      'Demo Account Active',
      'Connected as self-hosted@drive.healthy! You can now test uploading, downloading, and conflict-free database merging.'
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Disconnect Google Drive', 'Are you sure you want to disconnect from Google Drive?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await signOutGoogle();
          setAuthState({
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            user: null,
          });
          setDriveFile(null);
        },
      },
    ]);
  };

  const handleSyncNow = async () => {
    try {
      await triggerSync('smart-merge');
      await checkDriveFile();
      const logs = await getSyncAuditLogs(10);
      setAuditLogs(logs);
      Alert.alert('Sync Complete', 'Database successfully synchronized with Google Drive!');
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.message || 'Could not complete sync with Google Drive');
    }
  };

  const handleForceUpload = async () => {
    Alert.alert(
      'Upload to Google Drive',
      'This will export your local database snapshot and overwrite the cloud file. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            try {
              await triggerSync('upload-only');
              await checkDriveFile();
              Alert.alert('Upload Complete', 'Local database snapshot uploaded to Google Drive.');
            } catch (err: any) {
              Alert.alert('Upload Failed', err?.message || 'Upload error');
            }
          },
        },
      ]
    );
  };

  const handleForceDownload = async () => {
    Alert.alert(
      'Download from Google Drive',
      'This will pull the cloud database snapshot and replace local data. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download & Replace',
          style: 'destructive',
          onPress: async () => {
            try {
              await triggerSync('download-only');
              await refreshReports();
              Alert.alert('Download Complete', 'Local database updated from Google Drive snapshot.');
            } catch (err: any) {
              Alert.alert('Download Failed', err?.message || 'Download error');
            }
          },
        },
      ]
    );
  };

  const handleToggleAutoSync = async (value: boolean) => {
    setAutoSync(value);
    await setAutoSyncEnabled(value);
  };

  const handleSaveConfig = async () => {
    await saveGoogleClientConfig(clientConfig);
    const active = await getActiveClientId();
    setActiveClientId(active);
    Alert.alert('Configuration Saved', 'Your Google OAuth client settings have been updated.');
    setShowConfig(false);
  };

  const isSyncing = syncStatus.state === 'syncing';

  return (
    <ScrollView
      style={[
        styles.container,
        { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
      ]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Cloud size={26} color="#2563EB" />
          <Text style={[styles.title, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            {t('sync.backupTitle')}
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {t('sync.backupDesc')}
        </Text>
      </View>

      {/* Account Status Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        {authState.isAuthenticated && authState.user ? (
          <View>
            <View style={styles.connectedRow}>
              {authState.user.picture ? (
                <Image source={{ uri: authState.user.picture }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {authState.user.name?.charAt(0) || authState.user.email?.charAt(0) || 'U'}
                  </Text>
                </View>
              )}
              <View style={styles.accountInfo}>
                <View style={styles.connectedBadgeRow}>
                  <Text style={[styles.accountName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                    {authState.user.name}
                  </Text>
                  <View style={styles.onlineBadge}>
                    <CheckCircle2 size={12} color="#10B981" />
                    <Text style={styles.onlineBadgeText}>
                      {authState.isMockUser ? t('sync.demoConnected') : t('sync.driveConnected')}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.accountEmail, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {authState.user.email}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>{t('sync.disconnectBtn')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.unconnectedContent}>
            <View style={styles.unconnectedIcon}>
              <CloudOff size={32} color="#64748B" />
            </View>
            <Text style={[styles.unconnectedTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {t('sync.notConnectedTitle')}
            </Text>
            <Text style={[styles.unconnectedDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('sync.notConnectedDesc')}
            </Text>

            <View style={styles.authButtonsRow}>
              <TouchableOpacity
                style={[styles.primaryAuthBtn, !request && !activeClientId && { opacity: 0.9 }]}
                onPress={handleSignIn}
              >
                <Cloud size={18} color="#FFFFFF" />
                <Text style={styles.primaryAuthBtnText}>{t('sync.connectBtn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.demoAuthBtn} onPress={handleUseDemoAccount}>
                <Text style={styles.demoAuthBtnText}>{t('sync.tryDemoBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Sync Operations Card (Visible when connected) */}
      {authState.isAuthenticated && (
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {t('sync.driveFileAndActions')}
            </Text>
            {isSyncing && (
              <View style={styles.syncingPill}>
                <ActivityIndicator size="small" color="#2563EB" />
                <Text style={styles.syncingText}>{t('sync.statusSyncing')}</Text>
              </View>
            )}
          </View>

          {/* Drive file status */}
          <View
            style={[
              styles.driveFileBox,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.fileDetailRow}>
              <FileText size={16} color="#2563EB" />
              <Text style={[styles.fileName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {DEFAULT_DATABASE_FILENAME}
              </Text>
            </View>

            <View style={styles.fileMetaGrid}>
              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {t('sync.driveStatus')}
                </Text>
                <Text style={[styles.metaValue, { color: driveFile ? '#10B981' : '#F59E0B' }]}>
                  {isLoadingFile ? t('sync.checking') : driveFile ? t('sync.foundInDrive') : t('sync.readyToCreate')}
                </Text>
              </View>

              <View style={styles.metaItem}>
                <Text style={[styles.metaLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                  {t('sync.lastCloudSync')}
                </Text>
                <Text style={[styles.metaValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  {syncStatus.lastSyncTime
                    ? new Date(syncStatus.lastSyncTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : driveFile?.modifiedTime
                    ? new Date(driveFile.modifiedTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : t('sync.never')}
                </Text>
              </View>
            </View>
          </View>

          {/* Main Sync Button */}
          <TouchableOpacity
            style={[styles.syncNowButton, isSyncing && styles.syncNowButtonDisabled]}
            onPress={handleSyncNow}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <RefreshCw size={20} color="#FFFFFF" />
            )}
            <Text style={styles.syncNowText}>
              {isSyncing ? t('sync.syncingTwoWay') : t('sync.syncTwoWay')}
            </Text>
          </TouchableOpacity>

          {/* Secondary Actions */}
          <View style={styles.secondaryActionsRow}>
            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                {
                  backgroundColor: isDark ? '#334155' : '#F1F5F9',
                  borderColor: isDark ? '#475569' : '#E2E8F0',
                },
              ]}
              onPress={handleForceUpload}
              disabled={isSyncing}
            >
              <Upload size={16} color={isDark ? '#CBD5E1' : '#475569'} />
              <Text style={[styles.secondaryActionText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                {t('sync.forceUpload')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryActionBtn,
                {
                  backgroundColor: isDark ? '#334155' : '#F1F5F9',
                  borderColor: isDark ? '#475569' : '#E2E8F0',
                },
              ]}
              onPress={handleForceDownload}
              disabled={isSyncing}
            >
              <Download size={16} color={isDark ? '#CBD5E1' : '#475569'} />
              <Text style={[styles.secondaryActionText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                {t('sync.forceDownload')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto-Sync Toggle */}
          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={[styles.toggleLabel, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                {t('sync.autoSyncTitle')}
              </Text>
              <Text style={[styles.toggleDesc, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                {t('sync.autoSyncDesc')}
              </Text>
            </View>
            <Switch
              value={autoSync}
              onValueChange={handleToggleAutoSync}
              trackColor={{ false: '#94A3B8', true: '#2563EB' }}
            />
          </View>

          {/* Status Message / Result */}
          {syncStatus.lastResult && (
            <View style={styles.resultBanner}>
              <CheckCircle2 size={16} color="#10B981" />
              <Text style={styles.resultBannerText}>
                {syncStatus.lastResult.message || 'Sync completed successfully'}
              </Text>
            </View>
          )}

          {syncStatus.error && (
            <View style={styles.errorBanner}>
              <AlertTriangle size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>{syncStatus.error}</Text>
            </View>
          )}
        </View>
      )}

      {/* Database Versioning & Migrations Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleRowSmall}>
            <Database size={18} color="#2563EB" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {t('sync.databaseMigrations')}
            </Text>
          </View>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>
              v{versionInfo?.currentVersion ?? 1} Latest
            </Text>
          </View>
        </View>

        <Text style={[styles.cardSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
          {t('sync.databaseDesc')}
        </Text>

        <View style={styles.versionStatsGrid}>
          <View
            style={[
              styles.vStatBox,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.vStatLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('sync.currentVersion')}
            </Text>
            <Text style={[styles.vStatValue, { color: '#2563EB' }]}>
              v{versionInfo?.currentVersion ?? 1}
            </Text>
          </View>

          <View
            style={[
              styles.vStatBox,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.vStatLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('sync.schemaStatus')}
            </Text>
            <Text style={[styles.vStatValue, { color: '#10B981' }]}>
              {versionInfo?.isUpToDate ? t('sync.upToDate') : t('sync.migrating')}
            </Text>
          </View>

          <View
            style={[
              styles.vStatBox,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.vStatLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              {t('sync.appliedMigrations')}
            </Text>
            <Text style={[styles.vStatValue, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              {versionInfo?.appliedMigrations.length ?? 0}
            </Text>
          </View>
        </View>

        {/* Collapsible Migrations List */}
        <TouchableOpacity
          style={styles.expandHeader}
          onPress={() => setShowMigrations(!showMigrations)}
        >
          <View style={styles.expandTitleRow}>
            <Layers size={16} color="#64748B" />
            <Text style={[styles.expandTitle, { color: isDark ? '#CBD5E1' : '#475569' }]}>
              {t('sync.viewExecutedMigrations')}
            </Text>
          </View>
          {showMigrations ? (
            <ChevronUp size={16} color="#64748B" />
          ) : (
            <ChevronDown size={16} color="#64748B" />
          )}
        </TouchableOpacity>

        {showMigrations && (
          <View style={styles.migrationsList}>
            {versionInfo?.appliedMigrations.map((m) => (
              <View
                key={m.version}
                style={[
                  styles.migrationItem,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
              >
                <View style={styles.migrationItemHeader}>
                  <Text style={styles.migrationVersionTag}>v{m.version}</Text>
                  <Text
                    style={[styles.migrationName, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                  >
                    {m.name}
                  </Text>
                </View>
                <Text
                  style={[styles.migrationTimestamp, { color: isDark ? '#94A3B8' : '#64748B' }]}
                >
                  Applied: {new Date(m.appliedAt).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Collapsible Sync Audit Logs */}
        <TouchableOpacity
          style={styles.expandHeader}
          onPress={() => setShowAuditLogs(!showAuditLogs)}
        >
          <View style={styles.expandTitleRow}>
            <History size={16} color="#64748B" />
            <Text style={[styles.expandTitle, { color: isDark ? '#CBD5E1' : '#475569' }]}>
              Recent Sync Audit Logs ({auditLogs.length})
            </Text>
          </View>
          {showAuditLogs ? (
            <ChevronUp size={16} color="#64748B" />
          ) : (
            <ChevronDown size={16} color="#64748B" />
          )}
        </TouchableOpacity>

        {showAuditLogs && (
          <View style={styles.migrationsList}>
            {auditLogs.length === 0 ? (
              <Text style={[styles.emptyLogs, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                No sync events recorded yet.
              </Text>
            ) : (
              auditLogs.map((log) => (
                <View
                  key={log.id}
                  style={[
                    styles.logItem,
                    {
                      backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                      borderColor: isDark ? '#334155' : '#E2E8F0',
                    },
                  ]}
                >
                  <View style={styles.logHeader}>
                    <Text
                      style={[
                        styles.logActionTag,
                        {
                          backgroundColor:
                            log.status === 'success'
                              ? '#ECFDF5'
                              : log.status === 'failed'
                              ? '#FEF2F2'
                              : '#EFF6FF',
                          color:
                            log.status === 'success'
                              ? '#065F46'
                              : log.status === 'failed'
                              ? '#991B1B'
                              : '#1E40AF',
                        },
                      ]}
                    >
                      {log.action.toUpperCase()}
                    </Text>
                    <Text style={[styles.logTime, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </Text>
                  </View>
                  {log.details && (
                    <Text style={[styles.logDetails, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                      {log.details}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* Google Cloud OAuth Configuration Card */}
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <TouchableOpacity
          style={styles.configToggleRow}
          onPress={() => setShowConfig(!showConfig)}
        >
          <View style={styles.titleRowSmall}>
            <Key size={18} color="#2563EB" />
            <Text style={[styles.sectionTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
              Google Cloud OAuth Setup
            </Text>
          </View>
          {showConfig ? (
            <ChevronUp size={18} color="#64748B" />
          ) : (
            <ChevronDown size={18} color="#64748B" />
          )}
        </TouchableOpacity>

        {showConfig && (
          <View style={styles.configContent}>
            <Text style={[styles.configInstruction, { color: isDark ? '#94A3B8' : '#64748B' }]}>
              To connect your personal Google Drive in production, create a free OAuth 2.0 Client ID
              in Google Cloud Console and paste it below.
            </Text>

            {/* Redirect URI Info */}
            <View
              style={[
                styles.redirectUriBox,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <Text style={[styles.redirectUriLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Authorized Redirect URI:
              </Text>
              <Text
                selectable
                style={[styles.redirectUriValue, { color: isDark ? '#60A5FA' : '#2563EB' }]}
              >
                {getGoogleRedirectUri()}
              </Text>
            </View>

            {/* Web Client ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                Web Client ID
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  },
                ]}
                placeholder="e.g. 12345-abc.apps.googleusercontent.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={clientConfig.clientIdWeb}
                onChangeText={(text) =>
                  setClientConfig((prev) => ({ ...prev, clientIdWeb: text.trim() }))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* iOS Client ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                iOS Client ID (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  },
                ]}
                placeholder="e.g. 12345-ios.apps.googleusercontent.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={clientConfig.clientIdIos}
                onChangeText={(text) =>
                  setClientConfig((prev) => ({ ...prev, clientIdIos: text.trim() }))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Android Client ID */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                Android Client ID (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  },
                ]}
                placeholder="e.g. 12345-android.apps.googleusercontent.com"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={clientConfig.clientIdAndroid}
                onChangeText={(text) =>
                  setClientConfig((prev) => ({ ...prev, clientIdAndroid: text.trim() }))
                }
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity style={styles.saveConfigBtn} onPress={handleSaveConfig}>
              <Text style={styles.saveConfigText}>Save Client Configuration</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
    marginTop: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  titleRowSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  connectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  connectedBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  accountName: {
    fontSize: 16,
    fontWeight: '700',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  onlineBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
  },
  accountEmail: {
    fontSize: 13,
  },
  signOutBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  signOutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  unconnectedContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  unconnectedIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  unconnectedTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  unconnectedDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  authButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  primaryAuthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryAuthBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  demoAuthBtn: {
    borderWidth: 1,
    borderColor: '#94A3B8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  demoAuthBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  syncingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncingText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '600',
  },
  driveFileBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  fileDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fileMetaGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  syncNowButtonDisabled: {
    opacity: 0.7,
  },
  syncNowText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 9,
  },
  secondaryActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  toggleDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  resultBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  errorBannerText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  versionBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  versionBadgeText: {
    color: '#1D4ED8',
    fontSize: 11,
    fontWeight: '700',
  },
  versionStatsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  vStatBox: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  vStatLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  vStatValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  expandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  expandTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  migrationsList: {
    marginTop: 8,
    gap: 8,
  },
  migrationItem: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  migrationItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  migrationVersionTag: {
    backgroundColor: '#2563EB',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  migrationName: {
    fontSize: 13,
    fontWeight: '700',
  },
  migrationTimestamp: {
    fontSize: 11,
  },
  emptyLogs: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  logItem: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  logActionTag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTime: {
    fontSize: 11,
  },
  logDetails: {
    fontSize: 11,
    lineHeight: 15,
  },
  configToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configContent: {
    marginTop: 12,
  },
  configInstruction: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  redirectUriBox: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  redirectUriLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  redirectUriValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inputGroup: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  saveConfigBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  saveConfigText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
