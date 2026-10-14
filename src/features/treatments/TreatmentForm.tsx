import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeSelect } from '@/src/components/NativeSelect';
import { FormField } from '@/src/components/FormField';
import type { Condition, MedicationRequest } from 'fhir/r5';
import {
  FileText,
  FolderPlus,
  MessageSquareText,
  Tablets,
  User,
} from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import { SpecialistField } from '@/src/components/SpecialistField';
import { LinkedResourcesField } from '@/src/components/LinkedResourcesField';
import {
  useLinkFields,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
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
  requesterName?: string | null;
  dosageInstructions?: string | null;
  reason?: string | null;
  /** Conditions the treatment is associated with. */
  reasonConditionIds?: string[];
  notes?: string | null;
  /** Selected links to other resources, keyed by resource type. */
  links?: Record<string, LinkSelection>;
}

export interface TreatmentFormProps {
  initialValues?: Partial<TreatmentFormValues>;
  /** The active patient's conditions, offered as the indication. */
  conditions?: Condition[];
  onSubmit: (values: TreatmentFormValues) => Promise<void>;
  isEditing?: boolean;
  /** Known specialists offered as requester suggestions. */
  specialistSuggestions?: string[];
  /** Related resources this form can link to (edit only). */
  linkFields?: LinkFieldConfig[];
}

export function TreatmentForm({
  initialValues,
  conditions = [],
  onSubmit,
  isEditing = false,
  specialistSuggestions = [],
  linkFields = [],
}: TreatmentFormProps) {
  const links = useLinkFields(linkFields);
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
  const [reasonConditionIds, setReasonConditionIds] = useState(
    initialValues?.reasonConditionIds || []
  );
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [requesterName, setRequesterName] = useState(
    initialValues?.requesterName || ''
  );
  const [visibleFields, setVisibleFields] = useState({
    requester: Boolean(initialValues?.requesterName),
    instructions: Boolean(initialValues?.dosageInstructions),
    reason: Boolean(initialValues?.reason),
    reasonCondition: Boolean(initialValues?.reasonConditionIds?.length),
    notes: Boolean(initialValues?.notes),
  });
  const hasChanges = useHasChanges({
    title,
    intent,
    status,
    authoredDate,
    dosageInstructions,
    reason,
    reasonConditionIds,
    notes,
    requesterName,
    links: links.values,
  });

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const optionalFields = [
    { id: 'requester' as const, label: 'Requester (Specialist)', icon: User },
    {
      id: 'instructions' as const,
      label: 'Dosage Instructions',
      icon: Tablets,
    },
    { id: 'reason' as const, label: 'Reason', icon: MessageSquareText },
    {
      id: 'reasonCondition' as const,
      label: 'Associated Conditions',
      icon: FolderPlus,
    },
    { id: 'notes' as const, label: 'Notes', icon: FileText },
  ];
  const conditionOptions = conditions.flatMap((condition) =>
    condition.id
      ? [{ id: condition.id, label: getConditionTitle(condition) }]
      : []
  );
  const options = [
    ...optionalFields
      .filter(
        ({ id }) =>
          !visibleFields[id] &&
          // Linking needs at least one existing condition.
          (id !== 'reasonCondition' || conditionOptions.length > 0)
      )
      .map(({ id, label, icon: Icon }) => ({
        id,
        label,
        testID: `menu-add-treatment-${id}`,
        icon: (
          <Icon
            size={20}
            color={COLORS.light.primary}
            style={{ marginRight: 12 }}
          />
        ),
        onPress: () =>
          setVisibleFields((fields) => ({ ...fields, [id]: true })),
      })),
    ...links.menuOptions,
  ];
  const removeField = (id: keyof typeof visibleFields) => {
    setVisibleFields((fields) => ({ ...fields, [id]: false }));
    if (id === 'instructions') setDosageInstructions('');
    else if (id === 'reason') setReason('');
    else if (id === 'reasonCondition') setReasonConditionIds([]);
    else if (id === 'requester') setRequesterName('');
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
        requesterName: visibleFields.requester
          ? requesterName.trim() || null
          : null,
        dosageInstructions: visibleFields.instructions
          ? dosageInstructions.trim() || null
          : null,
        reason: visibleFields.reason ? reason.trim() || null : null,
        reasonConditionIds: visibleFields.reasonCondition
          ? reasonConditionIds
          : [],
        notes: visibleFields.notes ? notes.trim() || null : null,
        links: links.values,
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
            autoFocus: !isEditing,
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
            variant="input"
          />
        </FormField>
        {optionalFields.map(({ id, label }) => {
          if (!visibleFields[id]) return null;
          const fieldProps = {
            label,
            onRemove: () => removeField(id),
            removeTestID: `remove-treatment-${id}-button`,
          };
          if (id === 'requester') {
            return (
              <SpecialistField
                key={id}
                label={label}
                inputID="treatment-requester-input"
                name="requesterName"
                value={requesterName}
                onChangeText={setRequesterName}
                suggestions={specialistSuggestions}
                onRemove={fieldProps.onRemove}
                removeTestID={fieldProps.removeTestID}
              />
            );
          }
          if (id === 'reasonCondition') {
            return (
              <LinkedResourcesField
                key={id}
                label={label}
                searchLabel={`Select ${label.toLowerCase()}`}
                options={conditionOptions}
                selectedIds={reasonConditionIds}
                onChange={setReasonConditionIds}
                onRemove={fieldProps.onRemove}
                removeTestID={fieldProps.removeTestID}
                testID="treatment-reason-conditions-field"
                idPrefix="treatment-"
              />
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
        {links.fields}
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
        hasChanges={hasChanges}
        saveTestID="save-treatment-button"
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
