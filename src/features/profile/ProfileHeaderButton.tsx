import React from 'react';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useActivePatient } from './ActivePatientContext';
import { getPatientInitials } from './patientService';
import { COLORS } from '../../theme/colors';

export function ProfileHeaderButton() {
  const router = useRouter();
  const { activePatient } = useActivePatient();
  const initials = getPatientInitials(activePatient);

  return (
    <TouchableOpacity
      testID="profile-header-button"
      accessibilityLabel="View Profile"
      activeOpacity={0.7}
      style={styles.button}
      onPress={() => router.push('/profile')}
    >
      {initials && initials !== 'S' ? (
        <Text style={styles.initialsText}>{initials}</Text>
      ) : (
        <User size={18} color={COLORS.light.primary} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  initialsText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
});
