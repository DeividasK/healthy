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
import { ArrowLeft, Pencil, Plus, User, Check } from 'lucide-react-native';
import { useActivePatient } from './ActivePatientContext';
import { getPatientDisplayName, getPatientInitials } from './patientService';
import { formatDisplayDate } from '../../utils/dateUtils';
import { COLORS } from '../../theme/colors';

export function ProfileView() {
  const router = useRouter();
  const { activePatient, activePatientId, patients, setActivePatientId } =
    useActivePatient();

  const activeName = getPatientDisplayName(activePatient);
  const activeInitials = getPatientInitials(activePatient);
  const gender = activePatient?.gender
    ? activePatient.gender.charAt(0).toUpperCase() +
      activePatient.gender.slice(1)
    : 'Unknown';
  const birthDateFormatted = activePatient?.birthDate
    ? formatDisplayDate(activePatient.birthDate)
    : 'Not specified';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            testID="back-button"
            accessibilityLabel="Back"
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft color={COLORS.light.primaryForeground} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            testID="edit-profile-button"
            accessibilityLabel="Edit Profile"
            style={styles.editHeaderButton}
            onPress={() => {
              if (Platform.OS === 'web' && typeof document !== 'undefined') {
                (document.activeElement as HTMLElement)?.blur?.();
              }
              const targetId = activePatient?.id || activePatientId;
              if (targetId) {
                router.push(`/profile/${targetId}/edit`);
              }
            }}
          >
            <Pencil color={COLORS.light.primaryForeground} size={20} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
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
                  <View>
                    <Text style={styles.patientItemName}>{pName}</Text>
                  </View>
                </View>

                {isSelected && <Check size={20} color={COLORS.light.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.light.background,
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
  editHeaderButton: {
    padding: 4,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    fontSize: 15,
    color: COLORS.light.muted,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
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
