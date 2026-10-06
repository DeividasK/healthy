import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  KeyboardAvoidingView,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, User } from 'lucide-react-native';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { formatLocalDate } from '../../utils/dateUtils';
import { COLORS } from '../../theme/colors';
import { PatientInput } from './patientService';

export interface ProfileFormProps {
  initialValues?: Partial<PatientInput>;
  isEdit?: boolean;
  onSave: (values: PatientInput) => Promise<void>;
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
  onSave,
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

  const [isSaving, setIsSaving] = useState(false);

  const handleGenderPress = () => {
    if (Platform.OS === 'ios') {
      const options = [...GENDER_OPTIONS.map((g) => g.label), 'Cancel'];
      const cancelIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: cancelIndex,
          title: 'Select Gender',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelIndex) {
            setGender(GENDER_OPTIONS[buttonIndex].id);
          }
        }
      );
    }
  };

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

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/profile');
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedGenderLabel =
    GENDER_OPTIONS.find((g) => g.id === gender)?.label || 'Unknown';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
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
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit Profile' : 'New Profile'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar Preview */}
          <View style={styles.avatarPreviewContainer}>
            <View style={styles.avatarCircle}>
              <User size={40} color={COLORS.light.primary} />
            </View>
          </View>

          {/* Given Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Given Name *</Text>
            <TextInput
              testID="patient-given-name-input"
              id="patient-given-name-input"
              nativeID="patient-given-name-input"
              name="patientGivenName"
              accessibilityLabel="Given Name"
              style={styles.input}
              placeholder="e.g. Jane"
              placeholderTextColor={COLORS.light.placeholder}
              value={givenName}
              onChangeText={setGivenName}
              autoCapitalize="words"
            />
          </View>

          {/* Family Name Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Family Name</Text>
            <TextInput
              testID="patient-family-name-input"
              id="patient-family-name-input"
              nativeID="patient-family-name-input"
              name="patientFamilyName"
              accessibilityLabel="Family Name"
              style={styles.input}
              placeholder="e.g. Doe"
              placeholderTextColor={COLORS.light.placeholder}
              value={familyName}
              onChangeText={setFamilyName}
              autoCapitalize="words"
            />
          </View>

          {/* Gender Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Gender</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.webSelectWrapper}>
                <select
                  data-testid="patient-gender-select"
                  id="patient-gender-select"
                  name="patientGender"
                  value={gender}
                  onChange={(e) =>
                    setGender(
                      e.target.value as 'male' | 'female' | 'other' | 'unknown'
                    )
                  }
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${COLORS.light.border}`,
                    backgroundColor: COLORS.light.card,
                    color: COLORS.light.foreground,
                    fontSize: 16,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {GENDER_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </View>
            ) : (
              <TouchableOpacity
                testID="patient-gender-picker"
                style={styles.pickerButton}
                onPress={handleGenderPress}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedGenderLabel}
                </Text>
                <ChevronDown size={18} color={COLORS.light.iconMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Date of Birth Field */}
          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Date of Birth</Text>
            <View style={styles.datePickerContainer}>
              <NativeDatePicker
                testID="patient-birth-date-picker"
                value={birthDate || new Date()}
                onChange={(date) => setBirthDate(date)}
              />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Save Bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            testID="save-profile-button"
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
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
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  webSelectWrapper: {
    width: '100%',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.light.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.border,
  },
  saveButton: {
    backgroundColor: COLORS.light.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.light.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
});
