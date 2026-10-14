import { CATEGORY_OPTIONS } from './conditionCategories';
import type { ConditionInput } from './conditionService';
import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Activity,
  BadgeCheck,
  Tag,
  Calendar,
  FileText,
  MapPin,
} from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  useLinkFields,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { goBackOr } from '@/src/utils/navigation';

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
  onSave: (
    values: ConditionInput,
    links: Record<string, LinkSelection>
  ) => Promise<void>;
  /** Related resources this form can link to (edit only). */
  linkFields?: LinkFieldConfig[];
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
  linkFields = [],
}: ConditionFormProps) {
  const router = useRouter();
  const links = useLinkFields(linkFields);

  const [title, setTitle] = useState(initialValues?.title || '');

  const initialStatus =
    CONDITION_STATUS_OPTIONS.find(
      (s) => s.id === (initialValues?.clinicalStatus || initialValues?.statusId)
    ) || CONDITION_STATUS_OPTIONS[0];
  const initialVerification =
    initialValues?.verificationStatus ?? (isEdit ? '' : 'unconfirmed');
  const [verificationStatus, setVerificationStatus] =
    useState(initialVerification);
  const initialCategory = initialValues?.category ?? (isEdit ? '' : 'Ongoing');
  const [category, setCategory] = useState(initialCategory);
  const [showVerification, setShowVerification] = useState(
    Boolean(initialVerification)
  );
  const [showCategory, setShowCategory] = useState(Boolean(initialCategory));

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
  const hasChanges = useHasChanges({
    title,
    verificationStatus,
    category,
    status: selectedStatus.id,
    onsetDate,
    severity,
    bodySite,
    abatementDate,
    notes,
    links: links.values,
  });

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      await onSave(values, links.values);

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      goBackOr(router, '/');
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
      label: 'Verification Status',
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
      label: 'Category',
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
      label: 'Severity',
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
      label: 'Body Site',
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
      label: 'Resolution Date',
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
      label: 'Notes',
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
  plusMenuOptions.push(...links.menuOptions);

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
          {/* Condition Name Section (Required) */}
          <FormField
            label="Condition"
            required
            nativeID="condition-title-input"
            inputProps={{
              testID: 'condition-title-input',
              id: 'condition-title-input',
              nativeID: 'condition-title-input',
              name: 'title',
              autoFocus: !isEdit,
              accessibilityLabel: 'Condition Name',
              placeholder: 'Left Knee Pain',
              value: title,
              onChangeText: setTitle,
            }}
          />

          <FormField label="Status" nativeID="status-picker-select" required>
            <NativeSelect
              testID="status-picker-select"
              name="status"
              label="Condition status"
              value={selectedStatus.id}
              options={CONDITION_STATUS_OPTIONS.map(({ id, label }) => ({
                id,
                label,
              }))}
              onChange={(value) => {
                const found = CONDITION_STATUS_OPTIONS.find(
                  (option) => option.id === value
                );
                if (found) setSelectedStatus(found);
              }}
            />
          </FormField>

          <FormField
            label="Onset date"
            nativeID="condition-onset-date"
            required
          >
            <NativeDatePicker
              value={onsetDate}
              onChange={(date) => {
                if (date) setOnsetDate(date);
              }}
              testID="date-picker-button"
              id="condition-onset-date"
              name="onsetDate"
              variant="input"
            />
          </FormField>

          {showVerification && (
            <FormField
              label="Verification status"
              nativeID="verification-picker-button"
              removeTestID="remove-verification-button"
              removeLabel="Remove verification status"
              onRemove={() => {
                setShowVerification(false);
                setVerificationStatus('');
              }}
            >
              <NativeSelect
                testID="verification-picker-button"
                name="verificationStatus"
                label="Verification status"
                value={verificationStatus}
                options={VERIFICATION_OPTIONS}
                onChange={setVerificationStatus}
              />
            </FormField>
          )}
          {showCategory && (
            <FormField
              label="Category"
              nativeID="condition-category-input"
              removeTestID="remove-category-button"
              removeLabel="Remove category"
              onRemove={() => {
                setShowCategory(false);
                setCategory('');
              }}
            >
              <NativeSelect
                testID="condition-category-input"
                name="category"
                label="Category"
                value={category}
                options={[
                  { id: '', label: 'Not specified' },
                  ...CATEGORY_OPTIONS.map((option) => ({
                    id: option.label,
                    label: option.label,
                  })),
                  ...(category &&
                  !CATEGORY_OPTIONS.some((option) => option.label === category)
                    ? [{ id: category, label: category }]
                    : []),
                ]}
                onChange={setCategory}
              />
            </FormField>
          )}

          {/* Severity Section if toggled */}
          {showSeverity && (
            <FormField
              label="Severity"
              removeTestID="remove-severity-button"
              onRemove={() => {
                setShowSeverity(false);
                setSeverity(undefined);
              }}
            >
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
            </FormField>
          )}

          {/* Body Site Section if toggled */}
          {showBodySite && (
            <FormField
              label="Body Site"
              nativeID="condition-body-site-input"
              removeTestID="remove-body-site-button"
              onRemove={() => {
                setShowBodySite(false);
                setBodySite('');
              }}
              inputProps={{
                testID: 'condition-body-site-input',
                id: 'condition-body-site-input',
                nativeID: 'condition-body-site-input',
                name: 'bodySite',
                accessibilityLabel: 'Body Site',
                placeholder: 'e.g. Left knee, Lower back',
                value: bodySite,
                onChangeText: setBodySite,
              }}
            />
          )}

          {/* Resolution Date Section if toggled */}
          {showAbatementDate && (
            <FormField
              label="Resolution Date"
              removeTestID="remove-abatement-date-button"
              onRemove={() => {
                setShowAbatementDate(false);
                setAbatementDate(undefined);
              }}
            >
              <View style={styles.datePickerContainer}>
                <NativeDatePicker
                  value={abatementDate || new Date()}
                  onChange={(date) => setAbatementDate(date || undefined)}
                  testID="abatement-date-picker-button"
                />
              </View>
            </FormField>
          )}

          {/* Notes Textarea if toggled */}
          {showNotes && (
            <FormField
              label="Notes"
              nativeID="condition-notes-input"
              removeTestID="remove-notes-button"
              onRemove={() => {
                setShowNotes(false);
                setNotes('');
              }}
              inputProps={{
                testID: 'condition-notes-input',
                id: 'condition-notes-input',
                nativeID: 'condition-notes-input',
                name: 'notes',
                accessibilityLabel: 'Notes',
                placeholder: 'Add notes...',
                multiline: true,
                numberOfLines: 4,
                value: notes,
                onChangeText: setNotes,
              }}
            />
          )}

          {links.fields}
        </ScrollView>

        {/* Bottom Save Action */}
        <FormActionDock
          onAdd={() => setShowPlusMenu((visible) => !visible)}
          addExpanded={showPlusMenu}
          addDisabled={plusMenuOptions.length === 0}
          addTestID="add-option-button"
          onSave={handleSubmit}
          isSaving={isSaving}
          hasChanges={hasChanges}
        />

        {/* Plus Action Modal */}
        <FloatingAddMenu
          testID="form-add-menu"
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={plusMenuOptions}
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
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
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
});
