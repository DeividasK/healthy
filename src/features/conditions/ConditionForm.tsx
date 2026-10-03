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
import {
  Activity,
  ArrowLeft,
  Calendar,
  ChevronDown,
  FileText,
  MapPin,
  X,
} from 'lucide-react-native';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { PlusCircleButton } from '../../components/PlusCircleButton';
import { AddOptionsModal } from '../../components/AddOptionsModal';
import { formatLocalDate } from '../../utils/dateUtils';
import { COLORS } from '../../theme/colors';

export interface ConditionStatusOption {
  id: string;
  label: string;
  clinicalStatus: string;
  verificationStatus: string;
  dotColor: string;
}

export const CONDITION_STATUS_OPTIONS: ConditionStatusOption[] = [
  {
    id: 'unconfirmed',
    label: 'Unconfirmed',
    clinicalStatus: 'active',
    verificationStatus: 'unconfirmed',
    dotColor: '#F59E0B',
  },
  {
    id: 'provisional',
    label: 'Provisional',
    clinicalStatus: 'active',
    verificationStatus: 'provisional',
    dotColor: '#3B82F6',
  },
  {
    id: 'active',
    label: 'Active',
    clinicalStatus: 'active',
    verificationStatus: 'confirmed',
    dotColor: '#10B981',
  },
  {
    id: 'inactive',
    label: 'Inactive',
    clinicalStatus: 'inactive',
    verificationStatus: 'confirmed',
    dotColor: '#6B7280',
  },
  {
    id: 'remission',
    label: 'Remission',
    clinicalStatus: 'remission',
    verificationStatus: 'confirmed',
    dotColor: '#8B5CF6',
  },
  {
    id: 'resolved',
    label: 'Resolved',
    clinicalStatus: 'resolved',
    verificationStatus: 'confirmed',
    dotColor: '#717973',
  },
];

export interface SeverityOption {
  value: 'mild' | 'moderate' | 'severe';
  label: string;
  dotColor: string;
}

export const SEVERITY_OPTIONS: SeverityOption[] = [
  { value: 'mild', label: 'Mild', dotColor: '#10B981' },
  { value: 'moderate', label: 'Moderate', dotColor: '#F59E0B' },
  { value: 'severe', label: 'Severe', dotColor: '#EF4444' },
];

export interface ConditionFormValues {
  id?: string;
  title: string;
  statusId?: string;
  clinicalStatus?: string;
  verificationStatus?: string;
  onsetDate: Date;
  severity?: string;
  bodySite?: string;
  abatementDate?: Date;
  notes?: string;
}

export interface ConditionFormProps {
  initialValues?: Partial<ConditionFormValues>;
  isEdit?: boolean;
  onSave: (values: {
    id?: string;
    title: string;
    clinicalStatus: string;
    verificationStatus: string;
    onsetDate: string;
    severity?: string;
    bodySite?: string;
    abatementDate?: string;
    notes?: string;
  }) => Promise<void>;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export function ConditionForm({
  initialValues,
  isEdit = false,
  onSave,
}: ConditionFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initialValues?.title || '');

  // Determine initial status option
  const initialStatus = (() => {
    if (initialValues?.statusId) {
      const found = CONDITION_STATUS_OPTIONS.find(
        (s) => s.id === initialValues.statusId
      );
      if (found) return found;
    }
    if (initialValues?.clinicalStatus && initialValues?.verificationStatus) {
      const found = CONDITION_STATUS_OPTIONS.find(
        (s) =>
          s.clinicalStatus === initialValues.clinicalStatus &&
          s.verificationStatus === initialValues.verificationStatus
      );
      if (found) return found;
    }
    return CONDITION_STATUS_OPTIONS[0]; // 'unconfirmed'
  })();

  const [selectedStatus, setSelectedStatus] =
    useState<ConditionStatusOption>(initialStatus);
  const [onsetDate, setOnsetDate] = useState<Date>(
    initialValues?.onsetDate || new Date()
  );

  // Optional fields state
  const [severity, setSeverity] = useState<string | undefined>(
    initialValues?.severity
  );
  const [showSeverity, setShowSeverity] = useState(
    Boolean(initialValues?.severity)
  );

  const [bodySite, setBodySite] = useState(initialValues?.bodySite || '');
  const [showBodySite, setShowBodySite] = useState(
    Boolean(initialValues?.bodySite)
  );

  const [abatementDate, setAbatementDate] = useState<Date | undefined>(
    initialValues?.abatementDate
  );
  const [showAbatementDate, setShowAbatementDate] = useState(
    Boolean(initialValues?.abatementDate)
  );

  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [showNotes, setShowNotes] = useState(Boolean(initialValues?.notes));

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleStatusSelect = (opt: ConditionStatusOption) => {
    setSelectedStatus(opt);
  };

  const handleStatusPress = () => {
    if (Platform.OS === 'ios') {
      const options = [
        ...CONDITION_STATUS_OPTIONS.map((s) => s.label),
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
            handleStatusSelect(CONDITION_STATUS_OPTIONS[buttonIndex]);
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
      showAlert('Required Field', 'Please enter a condition name.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedOnsetDate = formatLocalDate(onsetDate);
      const formattedAbatementDate =
        showAbatementDate && abatementDate
          ? formatLocalDate(abatementDate)
          : undefined;

      await onSave({
        id: initialValues?.id,
        title: trimmedTitle,
        clinicalStatus: selectedStatus.clinicalStatus,
        verificationStatus: selectedStatus.verificationStatus,
        onsetDate: formattedOnsetDate,
        severity: showSeverity ? severity : undefined,
        bodySite: showBodySite && bodySite.trim() ? bodySite.trim() : undefined,
        abatementDate: formattedAbatementDate,
        notes: showNotes && notes.trim() ? notes.trim() : undefined,
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
      console.error('Failed to save condition:', err);
      showAlert('Error', 'Failed to save condition. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Build list of options available in the '+' menu
  const plusMenuOptions = [];
  if (!showSeverity) {
    plusMenuOptions.push({
      id: 'add-severity',
      label: 'Add Severity',
      icon: (
        <Activity
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-severity',
      onPress: () => {
        setShowSeverity(true);
        if (!severity) setSeverity('mild');
      },
    });
  }
  if (!showBodySite) {
    plusMenuOptions.push({
      id: 'add-body-site',
      label: 'Add Body Site',
      icon: (
        <MapPin
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-body-site',
      onPress: () => setShowBodySite(true),
    });
  }
  if (!showAbatementDate) {
    plusMenuOptions.push({
      id: 'add-abatement-date',
      label: 'Add Resolution Date',
      icon: (
        <Calendar
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-abatement-date',
      onPress: () => {
        setShowAbatementDate(true);
        if (!abatementDate) setAbatementDate(new Date());
      },
    });
  }
  if (!showNotes) {
    plusMenuOptions.push({
      id: 'add-notes',
      label: 'Add Notes',
      icon: (
        <FileText
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-notes',
      onPress: () => setShowNotes(true),
    });
  }

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
            {isEdit ? 'Edit Condition' : 'New Condition'}
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
                  { backgroundColor: selectedStatus.dotColor },
                ]}
              />
              <Text style={styles.statusPillText}>{selectedStatus.label}</Text>
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
                    value: selectedStatus.id,
                    onChange: (e: any) => {
                      const found = CONDITION_STATUS_OPTIONS.find(
                        (s) => s.id === e.target.value
                      );
                      if (found) handleStatusSelect(found);
                    },
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
                  CONDITION_STATUS_OPTIONS.map((opt) =>
                    React.createElement(
                      'option',
                      { key: opt.id, value: opt.id },
                      opt.label
                    )
                  )
                )}
            </TouchableOpacity>

            {/* Onset Date Pill */}
            <NativeDatePicker
              value={onsetDate}
              onChange={setOnsetDate}
              testID="date-picker-button"
            />

            {/* Plus Button to add optional fields */}
            {plusMenuOptions.length > 0 && (
              <PlusCircleButton
                testID="add-option-button"
                onPress={() => setShowPlusMenu(true)}
              />
            )}
          </View>

          {/* Condition Name Section (Required) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Condition</Text>
            <TextInput
              testID="condition-title-input"
              id="condition-title-input"
              nativeID="condition-title-input"
              name="title"
              accessibilityLabel="Condition Name"
              style={styles.textInput}
              placeholder="Left Knee Pain"
              placeholderTextColor={COLORS.light.placeholder}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Severity Section if toggled */}
          {showSeverity && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Severity</Text>
                <TouchableOpacity
                  testID="remove-severity-button"
                  onPress={() => {
                    setShowSeverity(false);
                    setSeverity(undefined);
                  }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <View style={styles.severityRow}>
                {SEVERITY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    testID={`severity-option-${opt.value}`}
                    style={[
                      styles.severityPill,
                      severity === opt.value && styles.severityPillSelected,
                    ]}
                    onPress={() => setSeverity(opt.value)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: opt.dotColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.severityPillText,
                        severity === opt.value &&
                          styles.severityPillTextSelected,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Body Site Section if toggled */}
          {showBodySite && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Body Site</Text>
                <TouchableOpacity
                  testID="remove-body-site-button"
                  onPress={() => {
                    setShowBodySite(false);
                    setBodySite('');
                  }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="condition-body-site-input"
                id="condition-body-site-input"
                nativeID="condition-body-site-input"
                name="bodySite"
                accessibilityLabel="Body Site"
                style={styles.textInput}
                placeholder="e.g. Left knee, Lower back"
                placeholderTextColor={COLORS.light.placeholder}
                value={bodySite}
                onChangeText={setBodySite}
              />
            </View>
          )}

          {/* Resolution Date Section if toggled */}
          {showAbatementDate && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Resolution Date</Text>
                <TouchableOpacity
                  testID="remove-abatement-date-button"
                  onPress={() => {
                    setShowAbatementDate(false);
                    setAbatementDate(undefined);
                  }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <View style={styles.datePickerContainer}>
                <NativeDatePicker
                  value={abatementDate || new Date()}
                  onChange={setAbatementDate}
                  testID="abatement-date-picker-button"
                />
              </View>
            </View>
          )}

          {/* Notes Textarea if toggled */}
          {showNotes && (
            <View style={styles.descriptionContainer}>
              <View style={styles.descriptionHeader}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TouchableOpacity
                  testID="remove-notes-button"
                  onPress={() => {
                    setShowNotes(false);
                    setNotes('');
                  }}
                  activeOpacity={0.7}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="condition-notes-input"
                id="condition-notes-input"
                nativeID="condition-notes-input"
                name="notes"
                accessibilityLabel="Notes"
                style={styles.descriptionInput}
                placeholder="Add notes..."
                placeholderTextColor={COLORS.light.placeholder}
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
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
          options={plusMenuOptions}
        />

        {/* Status Selection Modal for Android */}
        <AddOptionsModal
          visible={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          overlayTestID="status-menu-overlay"
          cardTestID="status-menu-card"
          options={CONDITION_STATUS_OPTIONS.map((opt) => ({
            id: opt.id,
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
            testID: `status-option-${opt.id}`,
            onPress: () => {
              handleStatusSelect(opt);
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  severityPillSelected: {
    backgroundColor: COLORS.light.card,
    borderColor: COLORS.light.primary,
    borderWidth: 2,
  },
  severityPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  severityPillTextSelected: {
    fontWeight: '700',
    color: COLORS.light.primary,
  },
  datePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
