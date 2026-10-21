import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Plus } from 'lucide-react-native';
import type { Patient } from 'fhir/r5';
import { COLORS } from '@/src/theme/colors';
import { PatientAvatar } from './PatientAvatar';
import { getPatientPhotoUri } from './patientPhoto';
import { getPatientDisplayName, getPatientInitials } from './patientNames';

/**
 * A strip of profile circles: tapping one makes it active, the last adds a
 * profile. The active profile is ringed.
 */
export function ProfileSwitcher({
  patients,
  activePatientId,
  onSelect,
  onAdd,
}: {
  patients: Patient[];
  activePatientId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.strip} testID="profile-switcher">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.items}
      >
        {patients.map((patient) => {
          const id = patient.id || '';
          const isActive = id === activePatientId;
          const name = getPatientDisplayName(patient);
          return (
            <TouchableOpacity
              key={id}
              testID={`profile-item-${id}`}
              accessibilityRole="button"
              accessibilityLabel={isActive ? name : `Switch to ${name}`}
              aria-current={isActive ? 'true' : undefined}
              style={styles.item}
              onPress={() => onSelect(id)}
              activeOpacity={0.7}
            >
              <View style={[styles.ring, isActive && styles.ringActive]}>
                <PatientAvatar
                  photoUri={getPatientPhotoUri(patient)}
                  style={[styles.circle, isActive && styles.circleActive]}
                  testID={`profile-item-avatar-${id}`}
                >
                  <Text
                    style={[styles.initials, isActive && styles.initialsActive]}
                  >
                    {getPatientInitials(patient)}
                  </Text>
                </PatientAvatar>
              </View>
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {name}
              </Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          testID="add-new-profile-button"
          accessibilityRole="button"
          accessibilityLabel="Add profile"
          style={styles.item}
          onPress={onAdd}
          activeOpacity={0.7}
        >
          <View style={styles.ring}>
            <View style={[styles.circle, styles.addCircle]}>
              <Plus size={22} color={COLORS.light.muted} />
            </View>
          </View>
          <Text style={styles.label}>Add</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const CIRCLE = 52;

const styles = StyleSheet.create({
  // Spans the screen width above the profile header.
  strip: {
    marginHorizontal: -20,
    backgroundColor: COLORS.light.dropdownHighlight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.cardBorder,
  },
  items: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 6,
  },
  item: {
    width: 72,
    alignItems: 'center',
    gap: 6,
  },
  // Leaves a gap between the photo and the active ring.
  ring: {
    padding: 3,
    borderRadius: CIRCLE,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ringActive: {
    borderColor: COLORS.light.primary,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    backgroundColor: COLORS.light.pillBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: {
    backgroundColor: COLORS.light.emptyIconContainer,
  },
  addCircle: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: COLORS.light.border,
  },
  initials: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.textSecondary,
  },
  initialsActive: {
    color: COLORS.light.primary,
  },
  label: {
    maxWidth: 72,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  labelActive: {
    color: COLORS.light.foreground,
  },
});
