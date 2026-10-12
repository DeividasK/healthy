import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { User } from 'lucide-react-native';
import { useActivePatient } from './ActivePatientContext';
import { getPatientInitials } from './patientService';
import { COLORS } from '@/src/theme/colors';

export function ProfileHeaderButton({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { activePatient } = useActivePatient();
  const initials = getPatientInitials(activePatient);

  return (
    <TouchableOpacity
      testID="profile-header-button"
      accessibilityRole="button"
      accessibilityLabel="View Profile"
      activeOpacity={0.7}
      style={[styles.button, style]}
      onPress={() => {
        const target = activePatient ? '/profile' : '/profile/new';
        if (pathname !== target) router.navigate(target);
      }}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.light.emptyIconContainer,
    borderWidth: 1,
    borderColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
});
