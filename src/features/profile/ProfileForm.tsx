import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { PatientInput } from './patientService';

export interface ProfileFormProps {
  initialValues?: Partial<PatientInput>;
  isEdit?: boolean;
  showBackButton?: boolean;
  hideHeader?: boolean;
  navigateOnSave?: boolean;
  onSave: (values: PatientInput) => Promise<void>;
  onDelete?: () => void;
}

const GENDER_OPTIONS: {
  id: 'male' | 'female' | 'other' | 'unknown';
  label: string;
}[] = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
  { id: 'unknown', label: 'Unknown' },
];

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function ProfileForm({
  initialValues,
  isEdit = false,
  showBackButton = true,
  hideHeader = false,
  navigateOnSave = true,
  onSave,
  onDelete,
}: ProfileFormProps) {
  const router = useRouter();
  const [givenName, setGivenName] = useState(initialValues?.givenName || '');
  const [familyName, setFamilyName] = useState(initialValues?.familyName || '');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'unknown'>(
    initialValues?.gender || 'unknown'
  );

  const [birthDate, setBirthDate] = useState<Date | null>(() => {
    if (initialValues?.birthDate) {
      const [y, m, d] = initialValues.birthDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return null;
  });
  const hasChanges = useHasChanges({
    givenName,
    familyName,
    gender,
    birthDate,
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmedGiven = givenName.trim();
    if (!trimmedGiven) {
      showAlert('Required Field', 'Please enter a given name.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedBirthDate = birthDate
        ? formatLocalDate(birthDate)
        : undefined;

      await onSave({
        id: initialValues?.id,
        givenName: trimmedGiven,
        familyName: familyName.trim() || undefined,
        gender,
        birthDate: formattedBirthDate,
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (navigateOnSave) {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/profile');
        }
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formContent = (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          hideHeader && styles.scrollContentEmbedded,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!hideHeader && (
          <ScreenHeading>
            {isEdit ? 'Edit Profile' : 'New Profile'}
          </ScreenHeading>
        )}
        {/* Avatar Preview */}
        <View style={styles.avatarPreviewContainer}>
          <View style={styles.avatarCircle}>
            <User size={40} color={COLORS.light.primary} />
          </View>
        </View>

        {/* Given Name Field */}
        <FormField
          label="Given Name"
          required
          nativeID="patient-given-name-input"
          inputProps={{
            testID: 'patient-given-name-input',
            id: 'patient-given-name-input',
            nativeID: 'patient-given-name-input',
            name: 'patientGivenName',
            autoFocus: !isEdit,
            accessibilityLabel: 'Given Name',
            placeholder: 'e.g. Jane',
            value: givenName,
            onChangeText: setGivenName,
            autoCapitalize: 'words',
          }}
        />

        {/* Family Name Field */}
        <FormField
          label="Family Name"
          nativeID="patient-family-name-input"
          inputProps={{
            testID: 'patient-family-name-input',
            id: 'patient-family-name-input',
            nativeID: 'patient-family-name-input',
            name: 'patientFamilyName',
            accessibilityLabel: 'Family Name',
            placeholder: 'e.g. Doe',
            value: familyName,
            onChangeText: setFamilyName,
            autoCapitalize: 'words',
          }}
        />

        {/* Gender Selector */}
        <FormField label="Gender" nativeID="patient-gender-select">
          <NativeSelect
            testID="patient-gender-select"
            name="patientGender"
            label="Gender"
            value={gender}
            options={GENDER_OPTIONS}
            onChange={(value) =>
              setGender(value as (typeof GENDER_OPTIONS)[number]['id'])
            }
          />
        </FormField>

        {/* Date of Birth Field */}
        <FormField label="Date of Birth" nativeID="patient-birth-date-picker">
          <NativeDatePicker
            testID="patient-birth-date-picker"
            id="patient-birth-date-picker"
            name="patientBirthDate"
            variant="input"
            value={birthDate}
            onChange={(date) => setBirthDate(date)}
          />
        </FormField>
      </ScrollView>

      <FormActionDock
        onSave={handleSubmit}
        isSaving={isSaving}
        saveLabel="Save Profile"
        saveTestID="save-profile-button"
        showCancel={showBackButton}
        hasChanges={hasChanges}
        onDelete={isEdit ? onDelete : undefined}
        deleteLabel="Delete Profile"
        deleteTestID="delete-profile-button"
      />
    </>
  );

  if (hideHeader) {
    return formContent;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>{formContent}</View>
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
  scrollContentEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 16,
  },
  avatarPreviewContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
