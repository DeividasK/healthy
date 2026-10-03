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
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { PlusCircleButton } from '../../components/PlusCircleButton';
import { AddOptionsModal } from '../../components/AddOptionsModal';
import type { EpisodeOfCare } from 'fhir/r5';
import { formatLocalDate } from '../../utils/dateUtils';
import { COLORS } from '../../theme/colors';

export const HEALTH_CASE_STATUS_OPTIONS: {
  value: EpisodeOfCare['status'];
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
  status: EpisodeOfCare['status'];
  startDate: Date;
  description?: string;
}

export interface HealthCaseFormProps {
  initialValues?: Partial<HealthCaseFormValues>;
  isEdit?: boolean;
  onSave: (values: {
    id?: string;
    title: string;
    status: EpisodeOfCare['status'];
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
  const [status, setStatus] = useState<EpisodeOfCare['status']>(
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
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const currentStatusObj =
    HEALTH_CASE_STATUS_OPTIONS.find((s) => s.value === status) ||
    HEALTH_CASE_STATUS_OPTIONS[0];

  const handleStatusSelect = (newStatus: EpisodeOfCare['status']) => {
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
          if (buttonIndex !== cancelButtonIndex) {
            handleStatusSelect(HEALTH_CASE_STATUS_OPTIONS[buttonIndex].value);
          }
        }
      );
    } else if (Platform.OS === 'android') {
      setShowStatusModal(true);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Required Field', 'Please enter a case title.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedDate = formatLocalDate(selectedDate);
      await onSave({
        id: initialValues?.id,
        title: trimmedTitle,
        status,
        startDate: formattedDate,
        description: showDescription
          ? description.trim() || undefined
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
              <Text style={styles.statusPillText}>
                {currentStatusObj.label}
              </Text>
              <ChevronDown
                color={COLORS.light.iconClear}
                size={16}
                style={{ marginLeft: 4 }}
              />

              {Platform.OS === 'web' &&
                React.createElement(
                  'select',
                  {
                    id: 'status-picker-select',
                    name: 'status',
                    value: status,
                    onChange: (e: any) =>
                      handleStatusSelect(
                        e.target.value as EpisodeOfCare['status']
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
              id="case-title-input"
              nativeID="case-title-input"
              name="title"
              accessibilityLabel="Case Title"
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
                id="case-description-input"
                nativeID="case-description-input"
                name="description"
                accessibilityLabel="Case Description"
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

        {/* Status Selection Modal for Android */}
        <AddOptionsModal
          visible={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          overlayTestID="status-menu-overlay"
          cardTestID="status-menu-card"
          options={HEALTH_CASE_STATUS_OPTIONS.map((opt) => ({
            id: opt.value,
            label: opt.label,
            icon: (
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: opt.dotColor,
                  marginRight: 12,
                }}
              />
            ),
            testID: `status-option-${opt.value}`,
            onPress: () => {
              handleStatusSelect(opt.value);
            },
          }))}
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
    backgroundColor: COLORS.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusPill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  descriptionInput: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.light.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.light.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.border,
  },
  saveButton: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebPrimaryButton,
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
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
