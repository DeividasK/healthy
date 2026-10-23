import React, { useState } from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
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
  Clock,
  FileText,
  FolderPlus,
  ListOrdered,
  MessageSquareText,
  Repeat2,
  ScrollText,
  Sparkles,
  Timer,
  User,
} from 'lucide-react-native';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import {
  NumberInput,
  ValueWithUnit,
} from '@/src/features/treatments/TimingFields';
import {
  OFFERED_WHEN,
  SPECIFIC_TIME,
  getCourseUnitOptions,
  getWhenOptions,
} from '@/src/features/treatments/regimen';
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
import { useOptionalFields } from '@/src/components/useOptionalFields';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import {
  getServiceRequestCategoryId,
  getServiceRequestCategoryOptions,
  getServiceRequestIntentOptions,
  getServiceRequestStatusOptions,
} from './serviceRequestLabels';
import {
  parseScheduleDraft,
  type ScheduleDraft,
  type ServiceRequestSchedule,
} from './serviceRequestSchedule';
import { AIImportModal } from '@/src/components/AIImportModal';
import {
  buildServiceRequestAIInstructions,
  parseServiceRequestAIReply,
  type ImportedServiceRequest,
} from './serviceRequestAIImport';

/** Fields that only apply to a request that repeats. */
const SCHEDULE_DETAILS = ['periodMax', 'count', 'duration', 'timeOfDay'];

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
  /** How it repeats; null removes the schedule. Loaded as a draft. */
  schedule?: ServiceRequestSchedule | null;
  scheduleDraft?: ScheduleDraft;
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
  const conditionOptions = conditions.flatMap((condition) =>
    condition.id
      ? [{ id: condition.id, label: getConditionTitle(condition) }]
      : []
  );
  const draft = initialValues?.scheduleDraft;
  const fields = useOptionalFields(
    {
      plannedDate: {
        label: 'Planned Date',
        icon: CalendarClock,
        empty: null as Date | null,
        initial: initialValues?.plannedDate || null,
        excludes: ['repeats'],
      },
      repeats: {
        label: 'Repeats Every',
        icon: Repeat2,
        empty: { period: '', periodUnit: 'd' },
        initial: draft && {
          period: draft.period,
          periodUnit: draft.periodUnit,
        },
        added: () => ({ period: '1', periodUnit: 'd' }),
        excludes: ['plannedDate'],
      },
      periodMax: {
        label: 'Up To Every',
        icon: Repeat2,
        empty: '',
        initial: draft?.periodMax,
      },
      count: {
        label: 'Sessions',
        icon: ListOrdered,
        empty: '',
        initial: draft?.count,
      },
      duration: {
        label: 'Duration (Minutes)',
        icon: Timer,
        empty: '',
        initial: draft?.duration,
      },
      timeOfDay: {
        label: 'Time of Day',
        icon: Clock,
        empty: { choice: '', time: '08:00' },
        initial: draft && { choice: draft.timeChoice, time: draft.time },
        added: () => ({ choice: OFFERED_WHEN[0], time: '08:00' }),
      },
      requester: {
        label: 'Requester (Specialist)',
        icon: User,
        empty: '',
        initial: initialValues?.requesterName || '',
      },
      instructions: {
        label: 'Instructions',
        icon: ScrollText,
        empty: '',
        initial: initialValues?.instructions || '',
      },
      reason: {
        label: 'Reason',
        icon: MessageSquareText,
        empty: '',
        initial: initialValues?.reason || '',
      },
      reasonCondition: {
        label: 'Associated Conditions',
        icon: FolderPlus,
        empty: [] as string[],
        initial: initialValues?.reasonConditionIds,
        // Linking needs at least one existing condition.
        available: conditionOptions.length > 0,
      },
      notes: {
        label: 'Notes',
        icon: FileText,
        empty: '',
        initial: initialValues?.notes || '',
      },
    },
    { testIDPrefix: 'menu-add-service-request-' }
  );
  const {
    plannedDate,
    repeats,
    periodMax,
    count,
    duration,
    timeOfDay,
    requester: requesterName,
    instructions,
    reason,
    reasonCondition: reasonConditionIds,
    notes,
  } = fields.values;
  const visibleFields = fields.shown;
  const hasChanges = useHasChanges({
    title,
    category,
    intent,
    status,
    authoredDate,
    plannedDate,
    repeats,
    periodMax,
    count,
    duration,
    timeOfDay,
    instructions,
    reason,
    reasonConditionIds,
    notes,
    requesterName,
    links: links.values,
  });

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  // Schedule details are offered once the request repeats.
  const options = [
    ...fields.menuOptions.filter(
      (option) => visibleFields.repeats || !SCHEDULE_DETAILS.includes(option.id)
    ),
    ...links.menuOptions,
  ];
  const removeRepeats = () => {
    fields.remove('repeats');
    for (const id of SCHEDULE_DETAILS)
      fields.remove(id as (typeof fields.order)[number]);
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Fills the form with the request read from the AI's reply, for review before saving. */
  const handleAIImport = (data: ImportedServiceRequest) => {
    setTitle(data.title);
    if (data.category) setCategory(data.category);
    if (data.intent) setIntent(data.intent);
    if (data.status) setStatus(data.status);
    if (data.authoredDate) setAuthoredDate(parseLocalDate(data.authoredDate));
    const { schedule } = data;
    fields.load({
      // A one-off date and a schedule replace each other.
      ...(data.plannedDate && {
        plannedDate: parseLocalDate(data.plannedDate),
        repeats: { period: '', periodUnit: 'd' },
        periodMax: '',
        count: '',
        duration: '',
        timeOfDay: { choice: '', time: '08:00' },
      }),
      ...(schedule && {
        plannedDate: null,
        repeats: { period: schedule.period, periodUnit: schedule.periodUnit },
        periodMax: schedule.periodMax,
        count: schedule.count,
        duration: schedule.duration,
        timeOfDay: { choice: schedule.timeChoice, time: schedule.time },
      }),
      ...(data.requester && { requester: data.requester }),
      ...(data.instructions && { instructions: data.instructions }),
      ...(data.reason && { reason: data.reason }),
      ...(data.notes && { notes: data.notes }),
    });
    setErrorMessage(null);
    setShowAIImport(false);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Service is required');
      return;
    }
    const schedule = visibleFields.repeats
      ? parseScheduleDraft(
          {
            ...repeats,
            periodMax,
            count,
            duration,
            timeChoice: timeOfDay.choice,
            time: timeOfDay.time,
          },
          {
            periodMax: visibleFields.periodMax,
            count: visibleFields.count,
            duration: visibleFields.duration,
            timeOfDay: visibleFields.timeOfDay,
          }
        )
      : null;
    if (typeof schedule === 'string') {
      setErrorMessage(schedule);
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
        schedule,
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
          {fields.order.map((id) => {
            if (!visibleFields[id]) return null;
            const label = fields.labels[id];
            const fieldProps = {
              label,
              onRemove: () => fields.remove(id),
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
                    onChange={(date) => fields.set('plannedDate', date)}
                    testID="service-request-planned-date-picker"
                    id="service-request-planned-date-input"
                    name="plannedDate"
                    variant="input"
                    allowFuture
                  />
                </FormField>
              );
            }
            if (id === 'repeats') {
              return (
                <FormField
                  key={id}
                  {...fieldProps}
                  onRemove={removeRepeats}
                  nativeID="service-request-period-input"
                >
                  <ValueWithUnit
                    input={
                      <NumberInput
                        id="service-request-period-input"
                        name="period"
                        label="Repeats every"
                        placeholder="e.g. 4"
                        value={repeats.period}
                        onChangeText={(text) =>
                          fields.set('repeats', { ...repeats, period: text })
                        }
                      />
                    }
                    testID="service-request-period-unit-select"
                    name="periodUnit"
                    unitLabel="Repeat unit"
                    unit={repeats.periodUnit}
                    options={getCourseUnitOptions(repeats.periodUnit)}
                    onUnitChange={(unit) =>
                      fields.set('repeats', { ...repeats, periodUnit: unit })
                    }
                  />
                </FormField>
              );
            }
            if (id === 'periodMax' || id === 'count' || id === 'duration') {
              const inputID = {
                periodMax: 'service-request-period-max-input',
                count: 'service-request-count-input',
                duration: 'service-request-duration-input',
              }[id];
              return (
                <FormField key={id} {...fieldProps} nativeID={inputID}>
                  <NumberInput
                    id={inputID}
                    name={id}
                    label={label}
                    placeholder={
                      id === 'periodMax'
                        ? 'e.g. 6'
                        : id === 'count'
                          ? 'e.g. 3'
                          : 'e.g. 30'
                    }
                    integer={id === 'count'}
                    value={fields.values[id]}
                    onChangeText={(text) => fields.set(id, text)}
                  />
                </FormField>
              );
            }
            if (id === 'timeOfDay') {
              return (
                <FormField
                  key={id}
                  {...fieldProps}
                  nativeID="service-request-time-of-day-select"
                >
                  <View style={styles.timeOfDay}>
                    <NativeSelect
                      testID="service-request-time-of-day-select"
                      name="timeOfDay"
                      label={label}
                      value={timeOfDay.choice}
                      options={getWhenOptions(timeOfDay.choice)}
                      onChange={(choice) =>
                        fields.set('timeOfDay', { ...timeOfDay, choice })
                      }
                    />
                    {timeOfDay.choice === SPECIFIC_TIME && (
                      <NativeTimePicker
                        value={timeOfDay.time}
                        onChange={(time) =>
                          fields.set('timeOfDay', { ...timeOfDay, time })
                        }
                        testID="service-request-time-input"
                        id="service-request-time-input"
                        name="time"
                      />
                    )}
                  </View>
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
                  onChangeText={(value) => fields.set('requester', value)}
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
                  onChange={(ids) => fields.set('reasonCondition', ids)}
                  onRemove={fieldProps.onRemove}
                  removeTestID={fieldProps.removeTestID}
                  testID="service-request-reason-conditions-field"
                  idPrefix="service-request-"
                />
              );
            }
            const textField =
              id === 'instructions' || id === 'reason' ? id : 'notes';
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
                  value: fields.values[textField],
                  onChangeText: (value) => fields.set(textField, value),
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
          // New requests can be filled in from the user's own AI assistant.
          secondaryActions={
            isEditing
              ? []
              : [
                  {
                    label: 'Import with AI',
                    testID: 'import-with-ai-button',
                    icon: Sparkles,
                    onPress: () => {
                      setShowPlusMenu(false);
                      setShowAIImport(true);
                    },
                  },
                ]
          }
        />
        {showAIImport && (
          <AIImportModal
            document="referral or order"
            instructions={buildServiceRequestAIInstructions}
            parse={parseServiceRequestAIReply}
            onClose={() => setShowAIImport(false)}
            onImport={handleAIImport}
          />
        )}
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
  timeOfDay: {
    gap: 8,
  },
});
