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
import type { Condition, MedicationRequest } from 'fhir/r5';
import {
  FileText,
  FolderPlus,
  MessageSquareText,
  Package,
  Play,
  Repeat,
  Sparkles,
  Tablets,
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
import { useOptionalFields } from '@/src/components/useOptionalFields';
import { formatLocalDate, parseLocalDate } from '@/src/utils/dateUtils';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import { COLORS } from '@/src/theme/colors';
import { DosingField } from './DosingField';
import { NumberInput, ValueWithUnit } from './TimingFields';
import {
  AddOptionsModal,
  type AddOptionItem,
} from '@/src/components/AddOptionsModal';
import {
  createDoseDraft,
  getAmountUnitOptions,
  getQuantityDraft,
  hasRegimen,
  validateQuantity,
  validateRegimen,
  type QuantityDraft,
  type RegimenDraft,
} from './regimen';
import {
  getTreatmentIntentOptions,
  getTreatmentStatusOptions,
} from './treatmentLabels';
import { AIImportModal } from '@/src/components/AIImportModal';
import {
  buildTreatmentAIInstructions,
  parseTreatmentAIReply,
  type ImportedTreatment,
} from './treatmentAIImport';

export interface TreatmentFormValues {
  id?: string;
  title: string;
  intent: MedicationRequest['intent'];
  status: MedicationRequest['status'];
  authoredDate?: Date;
  originalAuthoredOn?: string;
  requesterName?: string | null;
  dosageInstructions?: string | null;
  /** Structured doses; a treatment has these or text instructions. */
  regimen?: RegimenDraft | null;
  dispenseQuantity?: QuantityDraft | null;
  reason?: string | null;
  /** Conditions the treatment is associated with. */
  reasonConditionIds?: string[];
  notes?: string | null;
  /** Selected links to other resources, keyed by resource type. */
  links?: Record<string, LinkSelection>;
  /** New treatments only: the day taking it starts, if chosen. */
  usageStart?: Date;
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
    // New treatments are in force once recorded; FHIR's usual status.
    initialValues?.status || 'active'
  );
  const [authoredDate, setAuthoredDate] = useState<Date>(
    initialValues?.authoredDate || new Date()
  );
  // Records carrying both (e.g. imported) open on the regimen and keep their
  // text untouched unless the user replaces the regimen with text.
  const initialRegimen = hasRegimen(initialValues?.regimen);
  const conditionOptions = conditions.flatMap((condition) =>
    condition.id
      ? [{ id: condition.id, label: getConditionTitle(condition) }]
      : []
  );
  const fields = useOptionalFields(
    {
      requester: {
        label: 'Requester (Specialist)',
        icon: User,
        empty: '',
        initial: initialValues?.requesterName || '',
      },
      instructions: {
        label: 'Dosage',
        icon: Tablets,
        empty: '',
        initial: initialValues?.dosageInstructions || '',
        shown: Boolean(initialValues?.dosageInstructions) && !initialRegimen,
        // Dosing is either text instructions or a regimen, never both.
        excludes: ['regimen'],
      },
      regimen: {
        label: 'Regimen',
        icon: Repeat,
        empty: { phases: [] } as RegimenDraft,
        initial: initialValues?.regimen || undefined,
        shown: initialRegimen,
        added: (regimen) =>
          hasRegimen(regimen)
            ? regimen
            : { phases: [{ doses: [createDoseDraft()] }] },
        excludes: ['instructions'],
      },
      dispenseQuantity: {
        label: 'Quantity to Dispense',
        icon: Package,
        empty: getQuantityDraft(),
        initial: initialValues?.dispenseQuantity || undefined,
        shown: Boolean(initialValues?.dispenseQuantity?.value),
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
      usageStart: {
        label: 'Start taking',
        icon: Play,
        empty: null as Date | null,
        // New treatments start being taken today unless dismissed; usage of
        // a saved treatment is recorded from its page.
        initial: isEditing ? null : new Date(),
        added: () => new Date(),
        available: !isEditing,
      },
    },
    { testIDPrefix: 'menu-add-treatment-' }
  );
  const {
    requester: requesterName,
    instructions: dosageInstructions,
    regimen,
    dispenseQuantity,
    reason,
    reasonCondition: reasonConditionIds,
    notes,
    usageStart,
  } = fields.values;
  const visibleFields = fields.shown;
  const hasChanges = useHasChanges({
    title,
    intent,
    status,
    authoredDate,
    dosageInstructions,
    regimen,
    dispenseQuantity,
    reason,
    reasonConditionIds,
    notes,
    requesterName,
    usageStart: usageStart ? formatLocalDate(usageStart) : null,
    links: links.values,
  });

  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  // Fields a regimen phase or dose can add, shown in a centered menu.
  const [regimenOptions, setRegimenOptions] = useState<AddOptionItem[] | null>(
    null
  );
  const options = [...fields.menuOptions, ...links.menuOptions];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /** Fills the form with the treatment read from the AI's reply, for review before saving. */
  const handleAIImport = (data: ImportedTreatment) => {
    setTitle(data.title);
    if (data.intent) setIntent(data.intent);
    if (data.status) setStatus(data.status);
    if (data.authoredDate) setAuthoredDate(parseLocalDate(data.authoredDate));
    fields.load({
      ...(data.requester && { requester: data.requester }),
      // Dosing is either a regimen or text instructions, never both.
      ...(data.regimen && { regimen: data.regimen, instructions: '' }),
      ...(data.dosage && {
        instructions: data.dosage,
        regimen: { phases: [] },
      }),
      ...(data.dispenseQuantity && {
        dispenseQuantity: data.dispenseQuantity,
      }),
      ...(data.reason && { reason: data.reason }),
      ...(data.notes && { notes: data.notes }),
    });
    setErrorMessage(null);
    setShowAIImport(false);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Treatment name is required');
      return;
    }
    const fieldError =
      (visibleFields.regimen && validateRegimen(regimen)) ||
      (visibleFields.dispenseQuantity &&
        validateQuantity(dispenseQuantity, 'Quantity to dispense')) ||
      (usageStart &&
        formatLocalDate(usageStart) < formatLocalDate(authoredDate) &&
        "Start taking cannot be before the treatment's date");
    if (fieldError) {
      setErrorMessage(fieldError);
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
        // Hidden text is kept only beside a regimen it was stored with.
        dosageInstructions: visibleFields.instructions
          ? dosageInstructions.trim() || null
          : initialRegimen && visibleFields.regimen
            ? undefined
            : null,
        // Unchanged values are omitted so stored data is not rewritten.
        regimen: !visibleFields.regimen
          ? null
          : isUnchanged(regimen, initialValues?.regimen)
            ? undefined
            : regimen,
        dispenseQuantity: !visibleFields.dispenseQuantity
          ? null
          : isUnchanged(dispenseQuantity, initialValues?.dispenseQuantity)
            ? undefined
            : dispenseQuantity,
        reason: visibleFields.reason ? reason.trim() || null : null,
        reasonConditionIds: visibleFields.reasonCondition
          ? reasonConditionIds
          : [],
        notes: visibleFields.notes ? notes.trim() || null : null,
        links: links.values,
        usageStart: usageStart ?? undefined,
      });
    } catch (err: any) {
      console.error('Failed to save treatment:', err);
      setErrorMessage(err.message || 'Failed to save treatment');
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
          testID="treatment-form"
        >
          <ScreenHeading testID="treatment-form-title">
            {isEditing ? 'Edit Treatment' : 'Add Treatment'}
          </ScreenHeading>
          {errorMessage && (
            <FormErrorBanner
              message={errorMessage}
              testID="treatment-form-error"
            />
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
          {fields.order.map((id) => {
            if (!visibleFields[id]) return null;
            const label = fields.labels[id];
            const fieldProps = {
              label,
              onRemove: () => fields.remove(id),
              removeTestID: `remove-treatment-${id}-button`,
            };
            if (id === 'requester') {
              return (
                <AutocompleteTextField
                  key={id}
                  label={label}
                  inputID="treatment-requester-input"
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
            if (id === 'regimen' || id === 'instructions') {
              return (
                <DosingField
                  key={id}
                  kind={id}
                  instructions={dosageInstructions}
                  onInstructionsChange={(value) =>
                    fields.set('instructions', value)
                  }
                  regimen={regimen}
                  onRegimenChange={(value) => fields.set('regimen', value)}
                  onRemove={fieldProps.onRemove}
                  onShowOptions={setRegimenOptions}
                  idPrefix="treatment"
                />
              );
            }
            if (id === 'dispenseQuantity') {
              return (
                <FormField
                  key={id}
                  {...fieldProps}
                  nativeID="treatment-dispenseQuantity-input"
                >
                  <ValueWithUnit
                    input={
                      <NumberInput
                        id="treatment-dispenseQuantity-input"
                        name="dispenseQuantity"
                        label={label}
                        placeholder="e.g. 30"
                        value={dispenseQuantity.value}
                        onChangeText={(value) =>
                          fields.set('dispenseQuantity', (current) => ({
                            ...current,
                            value,
                          }))
                        }
                      />
                    }
                    testID="treatment-dispenseQuantity-unit-select"
                    name="dispenseQuantityUnit"
                    unitLabel="Quantity unit"
                    unit={dispenseQuantity.unit}
                    options={getAmountUnitOptions(dispenseQuantity.unit)}
                    onUnitChange={(unit) =>
                      fields.set('dispenseQuantity', (current) => ({
                        ...current,
                        unit,
                      }))
                    }
                  />
                </FormField>
              );
            }
            if (id === 'usageStart') {
              return (
                <FormField
                  key={id}
                  {...fieldProps}
                  nativeID="treatment-usageStart-input"
                >
                  <NativeDatePicker
                    value={usageStart}
                    onChange={(date) => {
                      if (date) fields.set('usageStart', date);
                    }}
                    testID="treatment-usageStart-picker"
                    id="treatment-usageStart-input"
                    name="usageStart"
                    variant="input"
                    // Taking it can be planned to start on a later day.
                    allowFuture
                  />
                </FormField>
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
                  testID="treatment-reason-conditions-field"
                  idPrefix="treatment-"
                />
              );
            }
            const textField = id === 'reason' ? 'reason' : 'notes';
            return (
              <FormField
                key={id}
                {...fieldProps}
                nativeID={`treatment-${id}-input`}
                inputProps={{
                  id: `treatment-${id}-input`,
                  nativeID: `treatment-${id}-input`,
                  name: id,
                  testID: `treatment-${id}-input`,
                  accessibilityLabel: label,
                  value: fields.values[textField],
                  onChangeText: (value) => fields.set(textField, value),
                  multiline: id !== 'reason',
                  numberOfLines: id === 'notes' ? 3 : 1,
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
          // New treatments can be filled in from the user's own AI assistant.
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
        <AddOptionsModal
          visible={Boolean(regimenOptions)}
          onClose={() => setRegimenOptions(null)}
          options={regimenOptions || []}
          overlayTestID="regimen-options-overlay"
          cardTestID="regimen-options-menu"
        />
        {showAIImport && (
          <AIImportModal
            document="prescription"
            instructions={buildTreatmentAIInstructions}
            parse={parseTreatmentAIReply}
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
});

/** Equal values, ignoring which empty optional fields the form shows. */
const isUnchanged = (value: unknown, initial: unknown) => {
  const json = (data: unknown) =>
    JSON.stringify(data, (key, field) =>
      key === 'shownFields' ? undefined : field
    );
  return initial !== undefined && json(value) === json(initial);
};
