import { AutocompleteDropdown } from '@/src/components/AutocompleteDropdown';
import type { ConditionInput } from './conditionService';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
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
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Activity,
  BadgeCheck,
  Tag,
  Calendar,
  ChevronDown,
  FileText,
  MapPin,
  X,
} from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { AddOptionsModal } from '@/src/components/AddOptionsModal';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { useSync } from '@/src/context/SyncContext';

export interface ConditionStatusOption {
  id: string;
  label: string;
  clinicalStatus: string;
  dotColor: string;
}

export const CONDITION_STATUS_OPTIONS: ConditionStatusOption[] = [
  {
    id: 'active',
    label: 'Active',
    clinicalStatus: 'active',
    dotColor: '#10B981',
  },
  {
    id: 'recurrence',
    label: 'Recurrence',
    clinicalStatus: 'recurrence',
    dotColor: '#F59E0B',
  },
  {
    id: 'relapse',
    label: 'Relapse',
    clinicalStatus: 'relapse',
    dotColor: '#F59E0B',
  },
  {
    id: 'inactive',
    label: 'Inactive',
    clinicalStatus: 'inactive',
    dotColor: '#6B7280',
  },
  {
    id: 'remission',
    label: 'Remission',
    clinicalStatus: 'remission',
    dotColor: '#8B5CF6',
  },
  {
    id: 'resolved',
    label: 'Resolved',
    clinicalStatus: 'resolved',
    dotColor: '#717973',
  },
  {
    id: 'unknown',
    label: 'Unknown',
    clinicalStatus: 'unknown',
    dotColor: '#6B7280',
  },
];
export const VERIFICATION_OPTIONS = [
  { id: '', label: 'Not specified' },
  { id: 'unconfirmed', label: 'Unconfirmed' },
  { id: 'provisional', label: 'Provisional' },
  { id: 'differential', label: 'Differential' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'refuted', label: 'Refuted' },
  { id: 'entered-in-error', label: 'Entered in error' },
];
export const CATEGORY_OPTIONS = [
  { id: 'problem-list-item', label: 'Problem list item' },
  { id: 'encounter-diagnosis', label: 'Encounter diagnosis' },
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
  category?: string;
  onsetDate: Date;
  severity?: string;
  bodySite?: string;
  abatementDate?: Date;
  notes?: string;
}

export interface ConditionFormProps {
  initialValues?: Partial<ConditionFormValues>;
  isEdit?: boolean;
  onDelete?: () => Promise<void>;
  onSave: (values: ConditionInput) => Promise<void>;
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
  onDelete,
}: ConditionFormProps) {
  const router = useRouter();
  const { triggerSync } = useSync();

  const [title, setTitle] = useState(initialValues?.title || '');

  const initialStatus =
    CONDITION_STATUS_OPTIONS.find(
      (s) => s.id === (initialValues?.clinicalStatus || initialValues?.statusId)
    ) || CONDITION_STATUS_OPTIONS[0];
  const initialVerification =
    initialValues?.verificationStatus ?? (isEdit ? '' : 'unconfirmed');
  const [verificationStatus, setVerificationStatus] =
    useState(initialVerification);
  const [showVerificationMenu, setShowVerificationMenu] = useState(false);
  const initialCategory =
    initialValues?.category ?? (isEdit ? '' : 'Problem list item');
  const [category, setCategory] = useState(initialCategory);
  const [showVerification, setShowVerification] = useState(
    Boolean(initialVerification)
  );
  const [showCategory, setShowCategory] = useState(Boolean(initialCategory));
  const [showCategories, setShowCategories] = useState(false);

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

      const values: ConditionInput = {
        id: initialValues?.id,
        title: trimmedTitle,
        clinicalStatus: selectedStatus.clinicalStatus,
        verificationStatus: showVerification ? verificationStatus : '',
        category: showCategory ? category : '',
        onsetDate: formattedOnsetDate,
        severity: showSeverity ? severity : undefined,
        bodySite: showBodySite && bodySite.trim() ? bodySite.trim() : undefined,
        abatementDate: formattedAbatementDate,
        notes: showNotes && notes.trim() ? notes.trim() : undefined,
      };
      if (isEdit) {
        const baseline: Partial<ConditionInput> = {
          title: initialValues?.title,
          clinicalStatus: initialStatus.clinicalStatus,
          verificationStatus: initialVerification,
          category: initialCategory,
          onsetDate: initialValues?.onsetDate
            ? formatLocalDate(initialValues.onsetDate)
            : formattedOnsetDate,
          severity: initialValues?.severity,
          bodySite: initialValues?.bodySite,
          abatementDate: initialValues?.abatementDate
            ? formatLocalDate(initialValues.abatementDate)
            : undefined,
          notes: initialValues?.notes,
        };
        const normalize = (value: unknown) => {
          return typeof value === 'string' ? value.trim() : value;
        };
        values.changedFields = (
          Object.keys(baseline) as (keyof ConditionInput)[]
        ).filter((key) => normalize(values[key]) !== normalize(baseline[key]));
      }
      await onSave(values);

      // Trigger automatic background sync
      triggerSync().catch((err) =>
        console.warn('Background sync failed on condition change:', err)
      );

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
  if (!showVerification)
    plusMenuOptions.push({
      id: 'add-verification',
      label: 'Add Verification Status',
      icon: (
        <BadgeCheck
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-verification',
      onPress: () => setShowVerification(true),
    });
  if (!showCategory)
    plusMenuOptions.push({
      id: 'add-category',
      label: 'Add Category',
      icon: (
        <Tag
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-category',
      onPress: () => setShowCategory(true),
    });
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
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.keyboardContainer}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeading>
            {isEdit ? 'Edit Condition' : 'New Condition'}
          </ScreenHeading>
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
                    'aria-label': 'Condition status',
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
              onChange={(date) => {
                if (date) setOnsetDate(date);
              }}
              testID="date-picker-button"
            />

            {/* Plus Button to add optional fields */}
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

          {showVerification && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Verification status</Text>
                <TouchableOpacity
                  testID="remove-verification-button"
                  accessibilityRole="button"
                  accessibilityLabel="Remove verification status"
                  onPress={() => {
                    setShowVerification(false);
                    setVerificationStatus('');
                  }}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                testID="verification-picker-button"
                accessibilityRole="button"
                accessibilityLabel="Verification status"
                style={styles.textInput}
                onPress={() => setShowVerificationMenu(true)}
              >
                <Text>
                  {VERIFICATION_OPTIONS.find(
                    (option) => option.id === verificationStatus
                  )?.label || verificationStatus}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {showCategory && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Category</Text>
                <TouchableOpacity
                  testID="remove-category-button"
                  accessibilityRole="button"
                  accessibilityLabel="Remove category"
                  onPress={() => {
                    setShowCategory(false);
                    setCategory('');
                    setShowCategories(false);
                  }}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="condition-category-input"
                id="condition-category-input"
                nativeID="condition-category-input"
                name="category"
                accessibilityLabel="Category"
                style={styles.textInput}
                value={category}
                onChangeText={setCategory}
                onFocus={() => setShowCategories(true)}
              />
              {showCategories && (
                <AutocompleteDropdown
                  items={CATEGORY_OPTIONS}
                  itemTestIDPrefix="category-option-"
                  onSelect={(item) => {
                    setCategory(item.label);
                    setShowCategories(false);
                  }}
                />
              )}
            </View>
          )}

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
                  onChange={(date) => setAbatementDate(date || undefined)}
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
        <FormActionDock
          onAdd={() => setShowPlusMenu((visible) => !visible)}
          addExpanded={showPlusMenu}
          addDisabled={plusMenuOptions.length === 0}
          addTestID="add-option-button"
          onSave={handleSubmit}
          isSaving={isSaving}
          deleteLabel="Delete condition"
          deleteTestID="delete-condition-button"
          deleteConfirmation={
            isEdit && onDelete
              ? {
                  title: 'Delete Condition',
                  message:
                    'Are you sure you want to delete this condition? This action cannot be undone.',
                  onConfirm: onDelete,
                }
              : undefined
          }
        />

        {/* Plus Action Modal */}
        <FloatingAddMenu
          testID="form-add-menu"
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={plusMenuOptions}
        />

        <AddOptionsModal
          visible={showVerificationMenu}
          onClose={() => setShowVerificationMenu(false)}
          options={VERIFICATION_OPTIONS.map((option) => ({
            id: option.id || 'unspecified',
            icon: null,
            label: option.label,
            testID: `verification-option-${option.id || 'unspecified'}`,
            onPress: () => setVerificationStatus(option.id),
          }))}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 132,
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
});
