import React, { useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeSelect } from '@/src/components/NativeSelect';
import { FormField } from '@/src/components/FormField';
import { FormErrorBanner } from '@/src/components/FormErrorBanner';
import type { CodeableConcept, Condition, ServiceRequest } from 'fhir/r5';
import {
  CalendarClock,
  FileText,
  FolderPlus,
  MessageSquareText,
  ScrollText,
  User,
} from 'lucide-react-native';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  FieldRevealProvider,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import { AutocompleteTextField } from '@/src/components/AutocompleteTextField';
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
  getServiceRequestCategoryId,
  getServiceRequestCategoryOptions,
  getServiceRequestIntentOptions,
  getServiceRequestStatusOptions,
} from './serviceRequestLabels';

export interface ServiceRequestFormValues {
  id?: string;
  title: string;
  /** Category option id: a SNOMED code or '' for none; undefined keeps. */
  category?: string;
  intent: ServiceRequest['intent'];
  status: ServiceRequest['status'];
  authoredDate?: Date;
  originalAuthoredOn?: string;
  /** Known planned date; null removes it, undefined keeps the stored value. */
  plannedDate?: Date | null;
  originalPlannedDate?: string;
  requesterName?: string | null;
  instructions?: string | null;
  reason?: string | null;
  reasonConditionIds?: string[];
  notes?: string | null;
  /** Selected links to other resources, keyed by resource type. */
  links?: Record<string, LinkSelection>;
}

export interface ServiceRequestFormProps {
  initialValues?: Partial<ServiceRequestFormValues>;
  /** The stored category, so unrecognised wording stays selectable. */
  initialCategory?: CodeableConcept;
  /** The active patient's conditions, offered as associated conditions. */
  conditions?: Condition[];
  onSubmit: (values: ServiceRequestFormValues) => Promise<void>;
  isEditing?: boolean;
  /** Known specialists offered as requester suggestions. */
  specialistSuggestions?: string[];
  /** Related resources this form can link to (edit only). */
  linkFields?: LinkFieldConfig[];
}

export function ServiceRequestForm({
  initialValues,
  initialCategory,
  conditions = [],
  onSubmit,
  isEditing = false,
  specialistSuggestions = [],
  linkFields = [],
}: ServiceRequestFormProps) {
  const links = useLinkFields(linkFields);
  const [title, setTitle] = useState(initialValues?.title || '');
  const initialCategoryId = getServiceRequestCategoryId(initialCategory);
  const [category, setCategory] = useState(initialCategoryId);
  const [intent, setIntent] = useState<ServiceRequest['intent']>(
    initialValues?.intent || 'plan'
  );
  const [status, setStatus] = useState<ServiceRequest['status']>(
    initialValues?.status || 'unknown'
  );
  const [authoredDate, setAuthoredDate] = useState<Date>(
    initialValues?.authoredDate || new Date()
  );
  const [plannedDate, setPlannedDate] = useState<Date | null>(
    initialValues?.plannedDate || null
  );
  const [instructions, setInstructions] = useState(
    initialValues?.instructions || ''
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
    plannedDate: Boolean(initialValues?.plannedDate),
    requester: Boolean(initialValues?.requesterName),
    instructions: Boolean(initialValues?.instructions),
    reason: Boolean(initialValues?.reason),
    reasonCondition: Boolean(initialValues?.reasonConditionIds?.length),
    notes: Boolean(initialValues?.notes),
  });
  const hasChanges = useHasChanges({
    title,
    category,
    intent,
    status,
    authoredDate,
    plannedDate,
    instructions,
    reason,
    reasonConditionIds,
    notes,
    requesterName,
    links: links.values,
  });

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const optionalFields = [
    { id: 'plannedDate' as const, label: 'Planned Date', icon: CalendarClock },
    { id: 'requester' as const, label: 'Requester (Specialist)', icon: User },
    { id: 'instructions' as const, label: 'Instructions', icon: ScrollText },
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
        testID: `menu-add-service-request-${id}`,
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
    if (id === 'plannedDate') setPlannedDate(null);
    else if (id === 'instructions') setInstructions('');
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
      setErrorMessage('Service is required');
      return;
    }
    setErrorMessage(null);

    const shownPlannedDate = visibleFields.plannedDate ? plannedDate : null;
    try {
      setIsSubmitting(true);
      await onSubmit({
        id: initialValues?.id,
        title: trimmedTitle,
        // An unchanged category keeps its stored codings and wording.
        category: category === initialCategoryId ? undefined : category,
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
        // An unchanged planned date keeps its stored precision.
        plannedDate:
          shownPlannedDate &&
          initialValues?.originalPlannedDate &&
          formatLocalDate(shownPlannedDate) ===
            initialValues.originalPlannedDate.slice(0, 10)
            ? undefined
            : shownPlannedDate,
        requesterName: visibleFields.requester
          ? requesterName.trim() || null
          : null,
        instructions: visibleFields.instructions
          ? instructions.trim() || null
          : null,
        reason: visibleFields.reason ? reason.trim() || null : null,
        reasonConditionIds: visibleFields.reasonCondition
          ? reasonConditionIds
          : [],
        notes: visibleFields.notes ? notes.trim() || null : null,
        links: links.values,
      });
    } catch (err: any) {
      console.error('Failed to save service request:', err);
      setErrorMessage(err.message || 'Failed to save service request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const { reveal, scrollViewProps } = useFieldReveal();

  return (
    <FieldRevealProvider value={reveal}>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          {...scrollViewProps}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          testID="service-request-form"
        >
          <ScreenHeading testID="service-request-form-title">
            {isEditing ? 'Edit Service Request' : 'Add Service Request'}
          </ScreenHeading>
          {errorMessage && (
            <FormErrorBanner
              message={errorMessage}
              testID="service-request-form-error"
            />
          )}
          <FormField
            label="Service"
            nativeID="service-request-title-input"
            required
            inputProps={{
              id: 'service-request-title-input',
              nativeID: 'service-request-title-input',
              name: 'title',
              testID: 'service-request-title-input',
              autoFocus: !isEditing,
              accessibilityLabel: 'Service',
              placeholder: 'e.g. Abdominal ultrasound',
              value: title,
              onChangeText: (text) => {
                setTitle(text);
                if (errorMessage) setErrorMessage(null);
              },
            }}
          />
          <FormField
            label="Category"
            nativeID="service-request-category-select"
          >
            <NativeSelect
              testID="service-request-category-select"
              name="category"
              label="Category"
              value={category}
              options={getServiceRequestCategoryOptions(initialCategory)}
              onChange={setCategory}
            />
          </FormField>
          <FormField
            label="Intent"
            nativeID="service-request-intent-select"
            required
          >
            <NativeSelect
              testID="service-request-intent-select"
              name="intent"
              label="Intent"
              value={intent}
              options={getServiceRequestIntentOptions(intent)}
              onChange={(value) => setIntent(value as ServiceRequest['intent'])}
            />
          </FormField>
          <FormField
            label="Status"
            nativeID="service-request-status-select"
            required
          >
            <NativeSelect
              testID="service-request-status-select"
              name="status"
              label="Status"
              value={status}
              options={getServiceRequestStatusOptions(status)}
              onChange={(value) => setStatus(value as ServiceRequest['status'])}
            />
          </FormField>
          <FormField
            label="Date"
            nativeID="service-request-date-input"
            required
          >
            <NativeDatePicker
              value={authoredDate}
              onChange={(date) => {
                if (date) setAuthoredDate(date);
              }}
              testID="service-request-date-picker"
              id="service-request-date-input"
              name="authoredDate"
              variant="input"
            />
          </FormField>
          {optionalFields.map(({ id, label }) => {
            if (!visibleFields[id]) return null;
            const fieldProps = {
              label,
              onRemove: () => removeField(id),
              removeTestID: `remove-service-request-${id}-button`,
            };
            if (id === 'plannedDate') {
              return (
                <FormField
                  key={id}
                  {...fieldProps}
                  nativeID="service-request-planned-date-input"
                >
                  <NativeDatePicker
                    value={plannedDate}
                    onChange={setPlannedDate}
                    testID="service-request-planned-date-picker"
                    id="service-request-planned-date-input"
                    name="plannedDate"
                    variant="input"
                    allowFuture
                  />
                </FormField>
              );
            }
            if (id === 'requester') {
              return (
                <AutocompleteTextField
                  key={id}
                  label={label}
                  inputID="service-request-requester-input"
                  name="requesterName"
                  placeholder="e.g. Dr. Sarah Adams"
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
                  testID="service-request-reason-conditions-field"
                  idPrefix="service-request-"
                />
              );
            }
            const [value, onChangeText] =
              id === 'instructions'
                ? [instructions, setInstructions]
                : id === 'reason'
                  ? [reason, setReason]
                  : [notes, setNotes];
            return (
              <FormField
                key={id}
                {...fieldProps}
                nativeID={`service-request-${id}-input`}
                inputProps={{
                  id: `service-request-${id}-input`,
                  nativeID: `service-request-${id}-input`,
                  name: id,
                  testID: `service-request-${id}-input`,
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
          saveLabel={isEditing ? 'Save changes' : 'Save service request'}
          onSave={handleSubmit}
          isSaving={isSubmitting}
          hasChanges={hasChanges}
          saveTestID="save-service-request-button"
        />
      </SafeAreaView>
    </FieldRevealProvider>
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
});
