import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  FieldRevealProvider,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import { useOptionalFields } from '@/src/components/useOptionalFields';
import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Calendar,
  ImagePlus,
  User,
  Users,
  VenusAndMars,
} from 'lucide-react-native';
import type { Attachment } from 'fhir/r5';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { PatientInput } from './patientService';
import { PatientAvatar } from './PatientAvatar';
import { IconTextButton } from './IconTextButton';
import { getPhotoUri, pickPatientPhoto } from './patientPhoto';

type Gender = NonNullable<PatientInput['gender']>;

export interface ProfileFormProps {
  initialValues?: Partial<PatientInput>;
  /** Optional fields to show from the start, e.g. ones a notice asked for. */
  showFields?: ('birthDate' | 'gender')[];
  isEdit?: boolean;
  showBackButton?: boolean;
  /** Replaces the default screen heading, e.g. a heading with a subline. */
  heading?: React.ReactNode;
  /** Content after the fields, e.g. a link to restore instead. */
  footer?: React.ReactNode;
  navigateOnSave?: boolean;
  onSave: (values: PatientInput) => Promise<void>;
  onDelete?: () => void;
}

const GENDER_OPTIONS: { id: Gender; label: string }[] = [
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

function parseBirthDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * A profile's name, then optional family name, date of birth, gender and
 * photo, each behind the `+` menu until added.
 */
export function ProfileForm({
  initialValues,
  showFields = [],
  isEdit = false,
  showBackButton = true,
  heading,
  footer,
  navigateOnSave = true,
  onSave,
  onDelete,
}: ProfileFormProps) {
  const router = useRouter();
  const [givenName, setGivenName] = useState(initialValues?.givenName || '');
  const fields = useOptionalFields<{
    familyName: string;
    birthDate: Date | undefined;
    gender: Gender | undefined;
    photo: Attachment | undefined;
  }>({
    familyName: {
      label: 'Family name',
      icon: Users,
      testID: 'menu-add-family-name',
      empty: '',
      initial: initialValues?.familyName,
    },
    birthDate: {
      label: 'Date of birth',
      icon: Calendar,
      testID: 'menu-add-birth-date',
      empty: undefined,
      initial: parseBirthDate(initialValues?.birthDate),
      ...(showFields.includes('birthDate') && { shown: true }),
    },
    gender: {
      label: 'Gender',
      icon: VenusAndMars,
      testID: 'menu-add-gender',
      empty: undefined,
      initial: initialValues?.gender,
      added: (gender) => gender ?? 'unknown',
      ...(showFields.includes('gender') && { shown: true }),
    },
    photo: {
      label: 'Photo',
      icon: ImagePlus,
      testID: 'menu-add-photo',
      empty: undefined,
      initial: initialValues?.photo,
    },
  });
  const { familyName, birthDate, gender, photo } = fields.values;
  const hasChanges = useHasChanges({ givenName, ...fields.values });
  const [isSaving, setIsSaving] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const { reveal, scrollViewProps } = useFieldReveal();

  const handlePickPhoto = async () => {
    try {
      const picked = await pickPatientPhoto();
      if (picked) fields.set('photo', picked);
    } catch (err) {
      console.error('Failed to load photo:', err);
      showAlert('Error', 'Failed to load the photo. Please try another image.');
    }
  };

  const handleSubmit = async () => {
    const trimmedGiven = givenName.trim();
    if (!trimmedGiven) {
      showAlert('Required Field', 'Please enter a name.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        id: initialValues?.id,
        givenName: trimmedGiven,
        familyName: familyName.trim() || undefined,
        gender,
        birthDate: birthDate ? formatLocalDate(birthDate) : undefined,
        photo,
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

  return (
    <FieldRevealProvider value={reveal}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.container}>
          <ScrollView
            {...scrollViewProps}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {heading ?? (
              <ScreenHeading>
                {isEdit ? 'Edit Profile' : 'New Profile'}
              </ScreenHeading>
            )}

            <FormField
              label="Name"
              required
              nativeID="patient-given-name-input"
              inputProps={{
                testID: 'patient-given-name-input',
                id: 'patient-given-name-input',
                nativeID: 'patient-given-name-input',
                name: 'patientGivenName',
                autoFocus: !isEdit,
                accessibilityLabel: 'Name',
                placeholder: 'e.g. Sam',
                value: givenName,
                onChangeText: setGivenName,
                autoCapitalize: 'words',
              }}
            />

            {fields.shown.familyName && (
              <FormField
                label="Family name"
                nativeID="patient-family-name-input"
                onRemove={() => fields.remove('familyName')}
                removeTestID="remove-family-name-button"
                inputProps={{
                  testID: 'patient-family-name-input',
                  id: 'patient-family-name-input',
                  nativeID: 'patient-family-name-input',
                  name: 'patientFamilyName',
                  accessibilityLabel: 'Family name',
                  placeholder: 'e.g. Doe',
                  value: familyName,
                  onChangeText: (value) => fields.set('familyName', value),
                  autoCapitalize: 'words',
                }}
              />
            )}

            {fields.shown.birthDate && (
              <FormField
                label="Date of birth"
                nativeID="patient-birth-date-picker"
                onRemove={() => fields.remove('birthDate')}
                removeTestID="remove-birth-date-button"
              >
                <NativeDatePicker
                  testID="patient-birth-date-picker"
                  id="patient-birth-date-picker"
                  name="patientBirthDate"
                  variant="input"
                  value={birthDate ?? null}
                  onChange={(date) =>
                    fields.set('birthDate', date ?? undefined)
                  }
                />
              </FormField>
            )}

            {fields.shown.gender && (
              <FormField
                label="Gender"
                nativeID="patient-gender-select"
                onRemove={() => fields.remove('gender')}
                removeTestID="remove-gender-button"
              >
                <NativeSelect
                  testID="patient-gender-select"
                  name="patientGender"
                  label="Gender"
                  value={gender ?? 'unknown'}
                  options={GENDER_OPTIONS}
                  onChange={(value) => fields.set('gender', value as Gender)}
                />
              </FormField>
            )}

            {fields.shown.photo && (
              <FormField
                label="Photo"
                nativeID="patient-photo"
                onRemove={() => fields.remove('photo')}
                removeTestID="remove-photo-button"
              >
                <View style={styles.photoRow}>
                  <PatientAvatar
                    photoUri={getPhotoUri(photo)}
                    style={styles.avatarCircle}
                    testID="patient-avatar-preview"
                  >
                    <User size={28} color={COLORS.light.primary} />
                  </PatientAvatar>
                  <IconTextButton
                    testID="upload-photo-button"
                    icon={ImagePlus}
                    label={photo ? 'Change photo' : 'Choose photo'}
                    onPress={handlePickPhoto}
                  />
                </View>
              </FormField>
            )}

            {footer}
          </ScrollView>

          <FormActionDock
            onAdd={() => setShowPlusMenu((visible) => !visible)}
            addExpanded={showPlusMenu}
            addDisabled={fields.menuOptions.length === 0}
            addTestID="add-option-button"
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

          <FloatingAddMenu
            testID="form-add-menu"
            visible={showPlusMenu}
            onClose={() => setShowPlusMenu(false)}
            options={fields.menuOptions}
          />
        </View>
      </SafeAreaView>
    </FieldRevealProvider>
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
    padding: 20,
    paddingBottom: 132,
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.light.emptyIconContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
