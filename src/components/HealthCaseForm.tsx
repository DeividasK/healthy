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
import { ArrowLeft, ChevronDown, FileText, X } from 'lucide-react-native';
import { NativeDatePicker } from './NativeDatePicker';
import { PlusCircleButton } from './PlusCircleButton';
import { AddOptionsModal } from './AddOptionsModal';
import { FHIREpisodeOfCareStatus } from '../types/fhir';
import { formatLocalDate } from '../utils/dateUtils';
import { COLORS } from '../theme/colors';

export const HEALTH_CASE_STATUS_OPTIONS: {
  value: FHIREpisodeOfCareStatus;
  label: string;
  dotColor: string;
}[] = [
  { value: 'active', label: 'Active', dotColor: '#10B981' },
  { value: 'onhold', label: 'On Hold', dotColor: '#F59E0B' },
  { value: 'finished', label: 'Finished', dotColor: '#717973' },
  { value: 'cancelled', label: 'Cancelled', dotColor: '#F43F5E' },
];

export interface HealthCaseFormValues {
  id?: string;
  title: string;
  status: FHIREpisodeOfCareStatus;
  startDate: Date;
  description?: string;
}

export interface HealthCaseFormProps {
  initialValues?: Partial<HealthCaseFormValues>;
  isEdit?: boolean;
  onSave: (values: {
    id?: string;
    title: string;
    status: FHIREpisodeOfCareStatus;
    startDate: string;
    description?: string;
  }) => Promise<void>;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function HealthCaseForm({
  initialValues,
  isEdit = false,
  onSave,
}: HealthCaseFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialValues?.title || '');
  const [status, setStatus] = useState<FHIREpisodeOfCareStatus>(
    initialValues?.status || 'active'
  );
  const [selectedDate, setSelectedDate] = useState<Date>(
    initialValues?.startDate || new Date()
  );
  const [description, setDescription] = useState(
    initialValues?.description || ''
  );
  const [showDescription, setShowDescription] = useState(
    Boolean(initialValues?.description)
  );
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentStatusObj =
    HEALTH_CASE_STATUS_OPTIONS.find((s) => s.value === status) ||
    HEALTH_CASE_STATUS_OPTIONS[0];

  const handleStatusSelect = (newStatus: FHIREpisodeOfCareStatus) => {
    setStatus(newStatus);
  };

  const handleStatusPress = () => {
    if (Platform.OS === 'ios') {
      const options = [
        ...HEALTH_CASE_STATUS_OPTIONS.map((s) => s.label),
        'Cancel',
      ];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Select Status',
        },
        (buttonIndex) => {
          if (
            buttonIndex !== cancelButtonIndex &&
            buttonIndex < HEALTH_CASE_STATUS_OPTIONS.length
          ) {
            handleStatusSelect(HEALTH_CASE_STATUS_OPTIONS[buttonIndex].value);
          }
        }
      );
    } else if (Platform.OS === 'android') {
      Alert.alert(
        'Select Status',
        undefined,
        [
          ...HEALTH_CASE_STATUS_OPTIONS.map((s) => ({
            text: s.label,
            onPress: () => handleStatusSelect(s.value),
          })),
          { text: 'Cancel', style: 'cancel' },
        ],
        { cancelable: true }
      );
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showAlert('Required Field', 'Please enter a case title.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedDate = formatLocalDate(selectedDate);
      await onSave({
        id: initialValues?.id,
        title: title.trim(),
        status,
        startDate: formattedDate,
        description:
          showDescription && description.trim()
            ? description.trim()
            : undefined,
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (err) {
      console.error('Failed to save health case:', err);
      showAlert('Error', 'Failed to save health case. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <TouchableOpacity
            testID="back-button"
            style={styles.backButton}
            onPress={() => {
              if (Platform.OS === 'web' && typeof document !== 'undefined') {
                (document.activeElement as HTMLElement)?.blur?.();
              }
              router.back();
            }}
            activeOpacity={0.7}
          >
            <ArrowLeft color={COLORS.light.primaryForeground} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEdit ? 'Edit Health Case' : 'New Health Case'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Pill Row: Status, Date, Plus */}
          <View style={styles.pillRow}>
            {/* Status Pill */}
            <TouchableOpacity
              testID="status-picker-button"
              style={styles.statusPill}
              onPress={handleStatusPress}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: currentStatusObj.dotColor },
                ]}
              />
              <Text style={styles.pillText}>{currentStatusObj.label}</Text>
              <ChevronDown
                color={COLORS.light.iconMuted}
                size={16}
                style={{ marginLeft: 4 }}
              />

              {Platform.OS === 'web' &&
                React.createElement(
                  'select',
                  {
                    value: status,
                    onChange: (e: any) =>
                      handleStatusSelect(
                        e.target.value as FHIREpisodeOfCareStatus
                      ),
                    style: {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      opacity: 0,
                      width: '100%',
                      height: '100%',
                      cursor: 'pointer',
                      zIndex: 10,
                    },
                    'data-testid': 'status-picker-select',
                  },
                  HEALTH_CASE_STATUS_OPTIONS.map((opt) =>
                    React.createElement(
                      'option',
                      { key: opt.value, value: opt.value },
                      opt.label
                    )
                  )
                )}
            </TouchableOpacity>

            {/* Date Pill */}
            <NativeDatePicker
              value={selectedDate}
              onChange={setSelectedDate}
              testID="date-picker-button"
            />

            {/* Plus Button to toggle Description */}
            {!showDescription && (
              <PlusCircleButton
                testID="add-description-button"
                onPress={() => setShowPlusMenu(true)}
              />
            )}
          </View>

          {/* Case Title Section */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Case Title</Text>
            <TextInput
              testID="case-title-input"
              style={styles.textInput}
              placeholder="Left Knee Pain"
              placeholderTextColor={COLORS.light.placeholder}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Description Textarea if toggled */}
          {showDescription && (
            <View style={styles.descriptionContainer}>
              <View style={styles.descriptionHeader}>
                <Text style={styles.inputLabel}>Description</Text>
                <TouchableOpacity
                  testID="remove-description-button"
                  onPress={() => {
                    setShowDescription(false);
                    setDescription('');
                  }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="case-description-input"
                style={styles.descriptionInput}
                placeholder="Enter case description..."
                placeholderTextColor={COLORS.light.placeholder}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          )}
        </ScrollView>

        {/* Bottom Save Action */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            testID="save-button"
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            disabled={isSaving}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plus Action Modal */}
        <AddOptionsModal
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={[
            ...(!showDescription
              ? [
                  {
                    id: 'add-description',
                    label: 'Add Description',
                    icon: (
                      <FileText
                        color={COLORS.light.primary}
                        size={20}
                        style={{ marginRight: 12 }}
                      />
                    ),
                    testID: 'menu-add-description',
                    onPress: () => {
                      setShowDescription(true);
                    },
                  },
                ]
              : []),
          ]}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.primary,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.light.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: COLORS.light.primaryForeground,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    position: 'relative',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  descriptionContainer: {
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    padding: 14,
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  descriptionInput: {
    fontSize: 15,
    color: COLORS.light.foreground,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.divider,
    backgroundColor: COLORS.light.card,
  },
  saveButton: {
    backgroundColor: COLORS.light.primary,
    borderRadius: 9999,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebPrimaryButton,
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
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
