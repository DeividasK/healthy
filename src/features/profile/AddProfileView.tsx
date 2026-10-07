import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  UserPlus,
  Archive,
  Cloud,
  Check,
} from 'lucide-react-native';
import type { Patient } from 'fhir/r5';
import { ProfileForm } from './ProfileForm';
import {
  createOrUpdatePatient,
  getPatientDisplayName,
  getPatientInitials,
} from './patientService';
import { useActivePatient } from './ActivePatientContext';
import { useGoogleAuthSignIn, GoogleAuthPayload } from './useGoogleAuthSignIn';
import { useSync } from '../../context/SyncContext';
import {
  listRemoteGooglePatients,
  restoreFromGoogleDrive,
  GoogleDriveConfig,
} from '../../services/syncManager';
import { restoreFromZipBytes } from '../../services/zipArchiveService';
import { COLORS } from '../../theme/colors';

export interface AddProfileViewProps {
  initialTab?: 'create' | 'file' | 'gdrive';
}

export function AddProfileView({
  initialTab = 'create',
}: AddProfileViewProps = {}) {
  const router = useRouter();
  const { patients, setActivePatientId, refreshPatients } = useActivePatient();
  const { connectWithGoogle, triggerSync, disconnect } = useSync();

  const [activeTab, setActiveTab] = useState<'create' | 'file' | 'gdrive'>(
    initialTab
  );
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [remotePatients, setRemotePatients] = useState<Patient[]>([]);
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [pendingGoogleConfig, setPendingGoogleConfig] =
    useState<GoogleDriveConfig | null>(null);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [showNoProfilesModal, setShowNoProfilesModal] = useState(false);
  const [noProfilesEmail, setNoProfilesEmail] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasExistingPatients = patients.length > 0;

  // Google OAuth Hook
  const { signIn: promptGoogleSignIn, isReady: isGoogleReady } =
    useGoogleAuthSignIn(async (authData: GoogleAuthPayload) => {
      setActionLoading('gdrive');
      try {
        const config: GoogleDriveConfig = {
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          tokenExpiresAt: authData.tokenExpiresAt,
          userSub: authData.userSub,
          userEmail: authData.userEmail,
          userName: authData.userName,
        };

        // Fetch remote patients list
        const remotes = await listRemoteGooglePatients(config);

        if (remotes.length === 0) {
          await disconnect();
          setPendingGoogleConfig(null);
          setNoProfilesEmail(authData.userEmail || '');
          setShowNoProfilesModal(true);
          setActionLoading(null);
          return;
        }

        // Show picker modal with all remote profiles selected by default
        setPendingGoogleConfig(config);
        setRemotePatients(remotes);
        setSelectedPatientIds(
          remotes.map((r) => r.id!).filter((id): id is string => Boolean(id))
        );
        setShowPickerModal(true);
      } catch (err) {
        console.error('Google restore failed:', err);
        Alert.alert(
          'Restore Failed',
          err instanceof Error
            ? err.message
            : 'Could not restore from Google Drive.'
        );
      } finally {
        setActionLoading(null);
      }
    });

  const toggleSelectPatient = (targetId: string) => {
    setSelectedPatientIds((prev) =>
      prev.includes(targetId)
        ? prev.filter((id) => id !== targetId)
        : [...prev, targetId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPatientIds.length === remotePatients.length) {
      setSelectedPatientIds([]);
    } else {
      setSelectedPatientIds(
        remotePatients
          .map((r) => r.id!)
          .filter((id): id is string => Boolean(id))
      );
    }
  };

  const handleRestoreSelectedRemotePatients = async () => {
    if (!pendingGoogleConfig || selectedPatientIds.length === 0) return;
    setActionLoading('restoring-selected');
    try {
      await restoreFromGoogleDrive(pendingGoogleConfig, selectedPatientIds);
      await connectWithGoogle({
        accessToken: pendingGoogleConfig.accessToken,
        refreshToken: pendingGoogleConfig.refreshToken,
        tokenExpiresAt: pendingGoogleConfig.tokenExpiresAt,
        userSub: pendingGoogleConfig.userSub,
        userEmail: pendingGoogleConfig.userEmail,
        userName: pendingGoogleConfig.userName,
      });
      await refreshPatients();
      if (selectedPatientIds[0]) {
        await setActivePatientId(selectedPatientIds[0]);
      }
      setShowPickerModal(false);
      triggerSync().catch(() => {});
      router.replace('/');
    } catch (err) {
      console.error('Failed to restore selected patient(s):', err);
      Alert.alert('Restore Failed', 'Failed to restore selected profile(s).');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActionLoading('file');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zipBytes = new Uint8Array(arrayBuffer);
      const res = await restoreFromZipBytes(zipBytes);
      await refreshPatients();

      // Refresh patients and switch to first restored if available
      const updatedPatients = await import('./patientService').then((m) =>
        m.getAllPatients()
      );
      if (updatedPatients.length > 0 && updatedPatients[0].id) {
        await setActivePatientId(updatedPatients[0].id);
      }

      triggerSync().catch(() => {});
      Alert.alert(
        'Restore Complete',
        `Restored ${res.patients} profile(s), ${res.reports} report(s), and ${res.conditions} condition(s).`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/'),
          },
        ]
      );
    } catch (err) {
      console.error('Zip restore failed:', err);
      Alert.alert(
        'Restore Failed',
        err instanceof Error ? err.message : 'Could not restore backup archive.'
      );
    } finally {
      setActionLoading(null);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleManualSave = async (values: {
    id?: string;
    givenName: string;
    familyName?: string;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    birthDate?: string;
  }) => {
    const created = await createOrUpdatePatient(values);
    await refreshPatients();
    if (created.id) {
      await setActivePatientId(created.id);
    }
    triggerSync().catch(() => {});
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Hidden file input for web zip restore */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          id="profile-restore-zip-file-input"
          name="profileRestoreZipFileInput"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleFilePicked}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        {hasExistingPatients ? (
          <TouchableOpacity
            testID="back-button"
            accessibilityLabel="Back"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft color={COLORS.light.primaryForeground} size={24} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
        <Text testID="add-profile-header-title" style={styles.headerTitle}>
          Add Profile
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionSubtitle}>
          Choose how you would like to set up this profile:
        </Text>

        {/* Option Cards Row / Stack */}
        <View style={styles.optionsContainer}>
          {/* Option 1: Create Manually */}
          <TouchableOpacity
            testID="option-create-profile"
            style={[
              styles.optionCard,
              activeTab === 'create' && styles.optionCardActive,
            ]}
            onPress={() => {
              if (activeTab !== 'create') {
                setActiveTab('create');
                router.replace('/profile/new');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <UserPlus
                size={22}
                color={
                  activeTab === 'create'
                    ? COLORS.light.primary
                    : COLORS.light.foreground
                }
              />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Create</Text>
              <Text style={styles.optionDescription}>
                Create a new local health profile
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Restore from file */}
          <TouchableOpacity
            testID="option-restore-file"
            style={[
              styles.optionCard,
              activeTab === 'file' && styles.optionCardActive,
            ]}
            onPress={() => {
              if (activeTab !== 'file') {
                setActiveTab('file');
                router.replace('/profile/restore-from-file');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Archive
                size={22}
                color={
                  activeTab === 'file'
                    ? COLORS.light.primary
                    : COLORS.light.foreground
                }
              />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Restore from file</Text>
              <Text style={styles.optionDescription}>
                Import from a .zip backup file
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 3: Restore from Google Drive */}
          <TouchableOpacity
            testID="option-restore-gdrive"
            style={[
              styles.optionCard,
              activeTab === 'gdrive' && styles.optionCardActive,
            ]}
            onPress={() => {
              if (activeTab !== 'gdrive') {
                setActiveTab('gdrive');
                router.replace('/profile/restore-from-google-drive');
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.optionIconContainer}>
              <Cloud
                size={22}
                color={
                  activeTab === 'gdrive' ? COLORS.light.primary : '#4285F4'
                }
              />
            </View>
            <View style={styles.optionTextContainer}>
              <Text style={styles.optionTitle}>Restore from Google Drive</Text>
              <Text style={styles.optionDescription}>
                Sync encrypted profile from your Google Drive
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Option 1: Manual Creation Form */}
        {activeTab === 'create' && (
          <View style={styles.formContainer}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Profile Details</Text>
              <View style={styles.dividerLine} />
            </View>

            <ProfileForm
              isEdit={false}
              showBackButton={false}
              hideHeader={true}
              onSave={handleManualSave}
            />
          </View>
        )}

        {/* Option 2: Restore from file action view */}
        {activeTab === 'file' && (
          <View style={styles.formContainer}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Restore From Backup</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.actionSectionCard}>
              <Text style={styles.actionSectionDescription}>
                Select an encrypted or unencrypted .zip backup file from your
                device storage to restore profiles, conditions, and lab results.
              </Text>

              <TouchableOpacity
                testID="select-profile-file-button"
                style={[
                  styles.primaryActionButton,
                  actionLoading !== null && styles.buttonDisabled,
                ]}
                disabled={actionLoading !== null}
                onPress={() => {
                  if (Platform.OS === 'web' && fileInputRef.current) {
                    fileInputRef.current.click();
                  } else {
                    Alert.alert(
                      'Restore from file',
                      'Select a Healthy .zip backup file from your device.'
                    );
                  }
                }}
                activeOpacity={0.8}
              >
                {actionLoading === 'file' ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.light.primaryForeground}
                  />
                ) : (
                  <>
                    <Archive
                      size={18}
                      color={COLORS.light.primaryForeground}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.primaryActionButtonText}>
                      Select profile
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Option 3: Restore from Google Drive action view */}
        {activeTab === 'gdrive' && (
          <View style={styles.formContainer}>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Google Drive Sync</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.actionSectionCard}>
              <Text style={styles.actionSectionDescription}>
                Connect your Google Drive account to find and restore previously
                backed up profiles.
              </Text>

              <TouchableOpacity
                testID="connect-google-drive-button"
                style={[
                  styles.googleActionButton,
                  (!isGoogleReady || actionLoading !== null) &&
                    styles.buttonDisabled,
                ]}
                disabled={!isGoogleReady || actionLoading !== null}
                onPress={() => promptGoogleSignIn()}
                activeOpacity={0.8}
              >
                {actionLoading === 'gdrive' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Cloud
                      size={18}
                      color="#FFFFFF"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.googleActionButtonText}>
                      Connect Google Drive
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Multi-Profile Picker Modal for Google Drive */}
      <Modal
        visible={showPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPickerModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="google-profile-picker-modal">
            <Text style={styles.modalTitle}>Select Profiles to Restore</Text>
            <Text style={styles.modalSubtitle}>
              Choose the profile(s) you wish to restore and sync to this device:
            </Text>

            {remotePatients.length > 1 && (
              <View style={styles.selectAllRow}>
                <TouchableOpacity
                  testID="toggle-select-all-profiles-button"
                  onPress={toggleSelectAll}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectAllText}>
                    {selectedPatientIds.length === remotePatients.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={styles.modalList}>
              {remotePatients.map((p) => {
                const pId = p.id || '';
                const pName = getPatientDisplayName(p);
                const pInitials = getPatientInitials(p);
                const isSelected = selectedPatientIds.includes(pId);

                return (
                  <TouchableOpacity
                    key={pId}
                    testID={`remote-profile-item-${pId}`}
                    style={[
                      styles.remoteProfileItem,
                      isSelected && styles.remoteProfileItemSelected,
                    ]}
                    onPress={() => toggleSelectPatient(pId)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                  >
                    <View style={styles.remoteProfileLeft}>
                      <View style={styles.remoteAvatar}>
                        <Text style={styles.remoteAvatarInitials}>
                          {pInitials}
                        </Text>
                      </View>
                      <Text style={styles.remoteProfileName}>{pName}</Text>
                    </View>

                    <View
                      testID={`remote-profile-checkbox-${pId}`}
                      style={[
                        styles.itemCheckbox,
                        isSelected && styles.itemCheckboxChecked,
                      ]}
                    >
                      {isSelected && (
                        <Check size={14} color="#FFFFFF" strokeWidth={3} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="cancel-remote-picker-button"
                style={styles.cancelModalButton}
                onPress={() => setShowPickerModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="restore-selected-profiles-button"
                style={[
                  styles.restoreSelectedButton,
                  selectedPatientIds.length === 0 && styles.buttonDisabled,
                ]}
                disabled={selectedPatientIds.length === 0}
                onPress={handleRestoreSelectedRemotePatients}
                activeOpacity={0.7}
              >
                <Text style={styles.restoreSelectedButtonText}>
                  {selectedPatientIds.length === 0
                    ? 'Select Profiles'
                    : selectedPatientIds.length === 1
                      ? 'Restore Profile'
                      : `Restore (${selectedPatientIds.length}) Profiles`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showNoProfilesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNoProfilesModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard} testID="no-profiles-found-modal">
            <Text style={styles.modalTitle}>No Profiles Found</Text>
            <Text style={styles.modalSubtitle} testID="no-profiles-message">
              {`No profiles found in ${noProfilesEmail ? `${noProfilesEmail} ` : ''}Google Drive.`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                testID="close-no-profiles-modal-button"
                style={styles.closeModalButton}
                onPress={() => setShowNoProfilesModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.closeModalButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.light.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.primaryForeground,
  },
  scroll: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.light.muted,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    gap: 14,
  },
  optionCardActive: {
    borderColor: COLORS.light.primary,
    backgroundColor: '#F5FFF7',
  },
  optionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: COLORS.light.muted,
  },
  formContainer: {
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.light.border,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.muted,
    textTransform: 'uppercase',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: COLORS.light.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.light.muted,
    lineHeight: 20,
    marginBottom: 16,
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  selectAllText: {
    fontSize: 13,
    color: COLORS.light.primary,
    fontWeight: '600',
  },
  modalList: {
    maxHeight: 240,
    marginBottom: 16,
  },
  remoteProfileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.background,
    marginBottom: 8,
  },
  remoteProfileItemSelected: {
    borderColor: COLORS.light.primary,
    backgroundColor: '#F5FFF7',
  },
  remoteProfileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  remoteAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.light.pillBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  remoteAvatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  remoteProfileName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  itemCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCheckboxChecked: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelModalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.light.border,
  },
  cancelModalButtonText: {
    fontSize: 14,
    color: COLORS.light.foreground,
    fontWeight: '600',
  },
  restoreSelectedButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.light.primary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  restoreSelectedButtonText: {
    fontSize: 14,
    color: COLORS.light.primaryForeground,
    fontWeight: '700',
  },
  closeModalButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.light.primary,
  },
  closeModalButtonText: {
    fontSize: 14,
    color: COLORS.light.primaryForeground,
    fontWeight: '700',
  },
  actionSectionCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    alignItems: 'center',
    marginTop: 4,
  },
  actionSectionDescription: {
    fontSize: 14,
    color: COLORS.light.muted,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  primaryActionButtonText: {
    color: COLORS.light.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
  googleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    width: '100%',
  },
  googleActionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
