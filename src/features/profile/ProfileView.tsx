import { ResourceActionDock } from '@/src/components/ResourceActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, User, Check } from 'lucide-react-native';
import { useActivePatient } from './ActivePatientContext';
import {
  getPatientDisplayName,
  getPatientInitials,
  getAllPatients,
} from './patientService';
import { formatDisplayDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { GoogleSyncCard } from './GoogleSyncCard';
import { PatientIdText } from './PatientIdText';
import { LoadingView } from '@/src/components/LoadingView';

export function ProfileView() {
  const router = useRouter();
  const {
    activePatient,
    activePatientId,
    patients,
    isLoading,
    setActivePatientId,
    refreshPatients,
  } = useActivePatient();

  React.useEffect(() => {
    if (!isLoading && patients.length === 0) {
      let isMounted = true;
      getAllPatients().then((actualPatients) => {
        if (!isMounted) return;
        if (actualPatients.length === 0) {
          router.replace('/profile/new');
        } else {
          refreshPatients();
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [isLoading, patients.length, refreshPatients, router]);

  const activeName = getPatientDisplayName(activePatient);
  const activeInitials = getPatientInitials(activePatient);
  const gender = activePatient?.gender
    ? activePatient.gender.charAt(0).toUpperCase() +
      activePatient.gender.slice(1)
    : 'Unknown';
  const birthDateFormatted = activePatient?.birthDate
    ? formatDisplayDate(activePatient.birthDate)
    : 'Not specified';
  const targetId =
    activePatient?.id ||
    activePatientId ||
    (patients.length > 0 ? patients[0].id : null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <LoadingView />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <ScreenHeading>Profile</ScreenHeading>
          {/* Active Profile Card */}
          <View style={styles.profileCard} testID="active-profile-card">
            <View style={styles.avatarSection}>
              <View style={styles.avatarCircle}>
                {activeInitials && activeInitials !== 'S' ? (
                  <Text style={styles.avatarInitials}>{activeInitials}</Text>
                ) : (
                  <User size={36} color={COLORS.light.primary} />
                )}
              </View>
              <Text style={styles.profileName} testID="profile-display-name">
                {activeName}
              </Text>
            </View>

            <View style={styles.divider} />

            {/* Info rows */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue} testID="profile-gender-value">
                {gender}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Date of Birth</Text>
              <Text style={styles.infoValue} testID="profile-birth-date-value">
                {birthDateFormatted}
              </Text>
            </View>

            {activePatient?.id && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Patient ID</Text>
                <PatientIdText
                  id={activePatient.id}
                  testID="profile-id-value"
                  style={styles.idValue}
                />
              </View>
            )}
          </View>

          {/* Switch Profile Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Profiles</Text>
            <TouchableOpacity
              testID="add-new-profile-button"
              style={styles.addProfileButton}
              onPress={() => router.push('/profile/new')}
              activeOpacity={0.7}
            >
              <Plus size={16} color={COLORS.light.primary} />
              <Text style={styles.addProfileButtonText}>Add Profile</Text>
            </TouchableOpacity>
          </View>

          {patients.map((p) => {
            const pId = p.id || '';
            const isSelected = pId === activePatientId;
            const pName = getPatientDisplayName(p);
            const pInitials = getPatientInitials(p);

            return (
              <TouchableOpacity
                key={pId}
                testID={`profile-item-${pId}`}
                style={[
                  styles.patientItemCard,
                  isSelected && styles.patientItemCardActive,
                ]}
                onPress={() => setActivePatientId(pId)}
                activeOpacity={0.7}
              >
                <View style={styles.patientItemLeft}>
                  <View
                    style={[
                      styles.patientMiniAvatar,
                      isSelected && styles.patientMiniAvatarActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.patientMiniInitials,
                        isSelected && styles.patientMiniInitialsActive,
                      ]}
                    >
                      {pInitials}
                    </Text>
                  </View>
                  <View style={styles.patientItemText}>
                    <Text style={styles.patientItemName}>{pName}</Text>
                    <PatientIdText id={pId} testID={`profile-item-id-${pId}`} />
                  </View>
                </View>

                {isSelected && <Check size={20} color={COLORS.light.primary} />}
              </TouchableOpacity>
            );
          })}

          {/* Cloud Sync & Backup Section */}
          <GoogleSyncCard />
        </ScrollView>
        {targetId && (
          <ResourceActionDock
            onEdit={() => router.push(`/profile/${targetId}/edit`)}
            editLabel="Edit Profile"
            editTestID="edit-profile-button"
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 132,
  },
  profileCard: {
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    marginBottom: 24,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      },
    }),
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 2,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.light.border,
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    flexShrink: 0,
    fontSize: 15,
    color: COLORS.light.muted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  idValue: {
    flexShrink: 1,
    marginLeft: 16,
    textAlign: 'right',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  addProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  addProfileButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.primary,
  },
  patientItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    marginBottom: 10,
  },
  patientItemCardActive: {
    borderColor: COLORS.light.primary,
    backgroundColor: '#F5FFF7',
  },
  patientItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 1,
  },
  patientItemText: {
    flexShrink: 1,
  },
  patientMiniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientMiniAvatarActive: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  patientMiniInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  patientMiniInitialsActive: {
    color: COLORS.light.primaryForeground,
  },
  patientItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
