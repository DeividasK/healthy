import React, { useEffect, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ArrowRightLeft, Check, Copy, User } from 'lucide-react-native';
import type { Patient } from 'fhir/r5';
import { COLORS } from '@/src/theme/colors';
import { formatDisplayDate, getAgeInYears } from '@/src/utils/dateUtils';
import { PatientAvatar } from './PatientAvatar';
import { getPatientPhotoUri } from './patientPhoto';
import { getPatientDisplayName, getPatientInitials } from './patientNames';

const COPIED_FEEDBACK_MS = 2000;

/** Keeps the start and end of a long ID, which is enough to tell profiles apart. */
export function shortenPatientId(id: string): string {
  return id.length > 20 ? `${id.slice(0, 12)}…${id.slice(-4)}` : id;
}

function getGender(patient: Patient): string {
  if (!patient.gender || patient.gender === 'unknown') return '';
  return patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1);
}

/** E.g. "Mar 12, 1988, 38 years". */
function getBirthDateWithAge(birthDate: string): string {
  const age = getAgeInYears(birthDate);
  return `${formatDisplayDate(birthDate)}, ${age} ${age === 1 ? 'year' : 'years'}`;
}

/**
 * The person at the top of the profile page: photo, name, gender, birth
 * date with age and patient ID, with the button that opens the profile switcher.
 */
export function ProfileHeader({
  patient,
  switcherOpen,
  onToggleSwitcher,
}: {
  patient: Patient;
  switcherOpen: boolean;
  onToggleSwitcher: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initials = getPatientInitials(patient);
  const gender = getGender(patient);

  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  const copyId = async () => {
    if (!patient.id) return;
    await Clipboard.setStringAsync(patient.id);
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(
      () => setCopied(false),
      COPIED_FEEDBACK_MS
    );
  };

  return (
    <View style={styles.header} testID="profile-header">
      <PatientAvatar
        photoUri={getPatientPhotoUri(patient)}
        style={styles.avatar}
        testID="profile-avatar"
      >
        {initials && initials !== 'S' ? (
          <Text style={styles.initials}>{initials}</Text>
        ) : (
          <User size={34} color={COLORS.light.primary} />
        )}
      </PatientAvatar>
      <View style={styles.details}>
        <Text
          style={styles.name}
          testID="profile-display-name"
          accessibilityRole="header"
        >
          {getPatientDisplayName(patient)}
        </Text>
        {gender !== '' && (
          <Text style={styles.line} testID="profile-gender-value">
            {gender}
          </Text>
        )}
        {patient.birthDate && (
          <Text style={styles.line} testID="profile-birth-date-value">
            {getBirthDateWithAge(patient.birthDate)}
          </Text>
        )}
        {patient.id && (
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>ID</Text>
            <TouchableOpacity
              testID="profile-id-copy-button"
              accessibilityRole="button"
              accessibilityLabel={
                copied ? 'Patient ID copied' : `Copy patient ID ${patient.id}`
              }
              style={styles.idPill}
              onPress={copyId}
              activeOpacity={0.7}
            >
              <Text style={styles.idValue} testID="profile-id-value">
                {shortenPatientId(patient.id)}
              </Text>
              {copied ? (
                <Check size={13} color={COLORS.light.primary} />
              ) : (
                <Copy size={13} color={COLORS.light.muted} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
      <TouchableOpacity
        testID="switch-profile-button"
        accessibilityRole="button"
        accessibilityLabel="Switch profile"
        aria-expanded={switcherOpen}
        accessibilityState={{ expanded: switcherOpen }}
        style={[styles.switchButton, switcherOpen && styles.switchButtonOpen]}
        onPress={onToggleSwitcher}
        activeOpacity={0.7}
      >
        <ArrowRightLeft size={18} color={COLORS.light.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 24,
    paddingBottom: 22,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.light.emptyIconContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: COLORS.light.foreground,
  },
  line: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  idLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: COLORS.light.muted,
  },
  idPill: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 9999,
    backgroundColor: COLORS.light.pillBackground,
  },
  idValue: {
    flexShrink: 1,
    fontSize: 11,
    color: COLORS.light.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  switchButton: {
    alignSelf: 'flex-start',
    marginTop: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
  },
  switchButtonOpen: {
    backgroundColor: COLORS.light.emptyIconContainer,
    borderColor: COLORS.light.emptyIconContainer,
  },
});
