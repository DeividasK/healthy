import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeSelect } from '@/src/components/NativeSelect';
import { FormField } from '@/src/components/FormField';
import type { Condition, MedicationRequest } from 'fhir/r5';
import { FileText } from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import {
  getTreatmentIntentOptions,
  getTreatmentStatusOptions,
} from './treatmentLabels';

export interface TreatmentFormValues {
  id?: string;
  title: string;
  intent: MedicationRequest['intent'];
  status: MedicationRequest['status'];
  authoredDate?: Date;
  originalAuthoredOn?: string;
  documenterName?: string;
  dosageInstructions?: string | null;
  reason?: string | null;
  /** Condition the treatment is indicated for; null when not linked. */
  reasonConditionId?: string | null;
  notes?: string | null;
}

export interface TreatmentFormProps {
  initialValues?: Partial<TreatmentFormValues>;
  /** The active patient's conditions, offered as the indication. */
  conditions?: Condition[];
  onSubmit: (values: TreatmentFormValues) => Promise<void>;
  onDelete?: () => Promise<void>;
  isEditing?: boolean;
  requireDocumenter?: boolean;
}

export function TreatmentForm({
  initialValues,
  conditions = [],
  onSubmit,
  onDelete,
  isEditing = false,
  requireDocumenter = false,
}: TreatmentFormProps) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [intent, setIntent] = useState<MedicationRequest['intent']>(
    initialValues?.intent || 'plan'
  );
  const [status, setStatus] = useState<MedicationRequest['status']>(
    initialValues?.status || 'unknown'
  );
  const [authoredDate, setAuthoredDate] = useState<Date>(
    initialValues?.authoredDate || new Date()
  );
  const [dosageInstructions, setDosageInstructions] = useState(
    initialValues?.dosageInstructions || ''
  );
  const [reason, setReason] = useState(initialValues?.reason || '');
  const [reasonConditionId, setReasonConditionId] = useState(
    initialValues?.reasonConditionId || ''
  );
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [visibleFields, setVisibleFields] = useState({
    instructions: Boolean(initialValues?.dosageInstructions),
    reason: Boolean(initialValues?.reason),
    reasonCondition: Boolean(initialValues?.reasonConditionId),
    notes: Boolean(initialValues?.notes),
  });
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [documenterName, setDocumenterName] = useState('');
  const optionalFields = [
    { id: 'instructions' as const, label: 'Dosage Instructions' },
    { id: 'reason' as const, label: 'Reason' },
    { id: 'reasonCondition' as const, label: 'Reason Condition' },
    { id: 'notes' as const, label: 'Notes' },
  ];
  const conditionOptions = [
    { id: '', label: 'Select condition' },
    ...conditions.map((condition) => ({
      id: condition.id!,
      label: getConditionTitle(condition),
    })),
    // Keep an unresolved existing link visible rather than dropping it.
    ...(reasonConditionId &&
    !conditions.some((condition) => condition.id === reasonConditionId)
      ? [{ id: reasonConditionId, label: reasonConditionId }]
      : []),
  ];
  const options = optionalFields
    .filter(({ id }) => !visibleFields[id])
    .map(({ id, label }) => ({
      id,
      label,
      testID: `menu-add-treatment-${id}`,
      icon: <FileText size={20} color={COLORS.light.primary} />,
      onPress: () => setVisibleFields((fields) => ({ ...fields, [id]: true })),
    }));
  const removeField = (id: keyof typeof visibleFields) => {
    setVisibleFields((fields) => ({ ...fields, [id]: false }));
    if (id === 'instructions') setDosageInstructions('');
    else if (id === 'reason') setReason('');
    else if (id === 'reasonCondition') setReasonConditionId('');
    else setNotes('');
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Treatment name is required');
      return;
    }
    if (requireDocumenter && !documenterName.trim()) {
      setErrorMessage('Documenter name is required');
      return;
    }
    setErrorMessage(null);

    try {
      setIsSubmitting(true);
      await onSubmit({
        id: initialValues?.id,
        title: trimmedTitle,
        intent,
        status,
        authoredDate:
          isEditing &&
          (initialValues?.originalAuthoredOn
            ? formatLocalDate(authoredDate) ===
              initialValues.originalAuthoredOn.slice(0, 10)
            : authoredDate.getTime() === initialValues?.authoredDate?.getTime())
            ? undefined
            : authoredDate,
        documenterName: requireDocumenter ? documenterName.trim() : undefined,
        dosageInstructions: visibleFields.instructions
          ? dosageInstructions.trim() || null
          : null,
        reason: visibleFields.reason ? reason.trim() || null : null,
        reasonConditionId: visibleFields.reasonCondition
          ? reasonConditionId || null
          : null,
        notes: visibleFields.notes ? notes.trim() || null : null,
      });
    } catch (err: any) {
      console.error('Failed to save treatment:', err);
      setErrorMessage(err.message || 'Failed to save treatment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="treatment-form"
      >
        <ScreenHeading testID="treatment-form-title">
          {isEditing ? 'Edit Treatment' : 'Add Treatment'}
        </ScreenHeading>
        {errorMessage && (
          <View
            style={styles.errorBanner}
            testID="treatment-form-error"
            accessibilityRole="alert"
          >
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
          </View>
        )}
        <FormField
          label="Treatment Name"
          nativeID="treatment-title-input"
          required
          inputProps={{
            id: 'treatment-title-input',
            nativeID: 'treatment-title-input',
            name: 'title',
            testID: 'treatment-title-input',
            accessibilityLabel: 'Treatment Name',
            placeholder: 'e.g. Amoxicillin 500mg',
            value: title,
            onChangeText: (text) => {
              setTitle(text);
              if (errorMessage) setErrorMessage(null);
            },
          }}
        />
        <FormField label="Intent" nativeID="treatment-intent-select" required>
          <NativeSelect
            testID="treatment-intent-select"
            name="intent"
            label="Intent"
            value={intent}
            options={getTreatmentIntentOptions(intent)}
            onChange={(value) =>
              setIntent(value as MedicationRequest['intent'])
            }
          />
        </FormField>
        <FormField label="Status" nativeID="treatment-status-select" required>
          <NativeSelect
            testID="treatment-status-select"
            name="status"
            label="Status"
            value={status}
            options={getTreatmentStatusOptions(status)}
            onChange={(value) =>
              setStatus(value as MedicationRequest['status'])
            }
          />
        </FormField>
        <FormField label="Date" nativeID="treatment-date-input" required>
          <NativeDatePicker
            value={authoredDate}
            onChange={(date) => {
              if (date) setAuthoredDate(date);
            }}
            testID="treatment-date-picker"
            id="treatment-date-input"
            name="authoredDate"
          />
        </FormField>
        {requireDocumenter && (
          <FormField
            label="Documenter name"
            nativeID="treatment-documenter-input"
            required
            inputProps={{
              id: 'treatment-documenter-input',
              nativeID: 'treatment-documenter-input',
              name: 'documenterName',
              testID: 'treatment-documenter-input',
              accessibilityLabel: 'Documenter name',
              value: documenterName,
              onChangeText: setDocumenterName,
            }}
          />
        )}
        {optionalFields.map(({ id, label }) => {
          if (!visibleFields[id]) return null;
          const fieldProps = {
            label,
            onRemove: () => removeField(id),
            removeTestID: `remove-treatment-${id}-button`,
          };
          if (id === 'reasonCondition') {
            return (
              <FormField
                key={id}
                {...fieldProps}
                nativeID="treatment-reason-condition-select"
              >
                <NativeSelect
                  testID="treatment-reason-condition-select"
                  name="reasonConditionId"
                  label={label}
                  value={reasonConditionId}
                  options={conditionOptions}
                  onChange={setReasonConditionId}
                />
              </FormField>
            );
          }
          const [value, onChangeText] =
            id === 'instructions'
              ? [dosageInstructions, setDosageInstructions]
              : id === 'reason'
                ? [reason, setReason]
                : [notes, setNotes];
          return (
            <FormField
              key={id}
              {...fieldProps}
              nativeID={`treatment-${id}-input`}
              inputProps={{
                id: `treatment-${id}-input`,
                nativeID: `treatment-${id}-input`,
                name: id === 'instructions' ? 'dosageInstructions' : id,
                testID: `treatment-${id}-input`,
                accessibilityLabel: label,
                value,
                onChangeText,
                multiline: id !== 'reason',
                numberOfLines:
                  id === 'instructions' ? 4 : id === 'notes' ? 3 : 1,
              }}
            />
          );
        })}
      </ScrollView>
      <FloatingAddMenu
        visible={showPlusMenu}
        onClose={() => setShowPlusMenu(false)}
        options={options}
        testID="form-add-menu"
      />
      <FormActionDock
        onAdd={() => setShowPlusMenu((visible) => !visible)}
        addExpanded={showPlusMenu}
        addDisabled={!options.length}
        saveLabel={isEditing ? 'Save changes' : 'Save treatment'}
        onSave={handleSubmit}
        isSaving={isSubmitting}
        saveTestID="save-treatment-button"
        deleteLabel="Delete treatment"
        deleteTestID="delete-treatment-button"
        deleteConfirmation={
          isEditing && onDelete
            ? {
                title: 'Delete Treatment',
                message:
                  'Are you sure you want to delete this treatment? This action cannot be undone.',
                onConfirm: onDelete,
              }
            : undefined
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  errorBanner: {
    backgroundColor: COLORS.light.badgeHighBg,
    borderWidth: 1,
    borderColor: COLORS.light.badgeHighBorder,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorBannerText: {
    color: COLORS.light.destructive,
    fontSize: 14,
    fontWeight: '500',
  },
});
