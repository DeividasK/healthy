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
import { getPatientDisplayName } from './patientNames';
import { PatientAvatar } from './PatientAvatar';
import { getPatientPhotoUri } from './patientPhoto';
import { COLORS } from '@/src/theme/colors';

export function ProfileHeaderButton({
  style,
  showName = false,
}: {
  style?: StyleProp<ViewStyle>;
  /** Shows the profile's name beside the avatar (the desktop sidebar). */
  showName?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { activePatient } = useActivePatient();
  const initials = getPatientInitials(activePatient);
  // Nothing to show before a profile exists.
  if (!activePatient) return null;

  return (
    <TouchableOpacity
      testID="profile-header-button"
      accessibilityRole="button"
      accessibilityLabel="View Profile"
      activeOpacity={0.7}
      style={style}
      onPress={() => {
        if (pathname !== '/profile') router.navigate('/profile');
      }}
    >
      <PatientAvatar
        photoUri={getPatientPhotoUri(activePatient)}
        style={styles.avatar}
        testID="profile-header-avatar"
      >
        {initials && initials !== 'S' ? (
          <Text style={styles.initialsText}>{initials}</Text>
        ) : (
          <User size={16} color={COLORS.light.primary} />
        )}
      </PatientAvatar>
      {showName && (
        <Text style={styles.name} numberOfLines={1}>
          {getPatientDisplayName(activePatient)}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // The same size as the app logo beside it.
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.light.emptyIconContainer,
    borderWidth: 1,
    borderColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  initialsText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
});
