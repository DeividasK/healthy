import type {
  ConsultationInput,
  ConsultationDiagnosisInput,
} from './consultationService';
import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Platform,
  Alert,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Activity,
  Stethoscope,
  Clock,
  FileText,
  FolderPlus,
  Hash,
  User,
  Hospital,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  FieldRevealProvider,
  FieldRevealSpace,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import {
  AddOptionsModal,
  type AddOptionItem,
} from '@/src/components/AddOptionsModal';
import { GroupHeader } from '@/src/components/GroupHeader';
import { NativeSelect } from '@/src/components/NativeSelect';
import { AutocompleteDropdown } from '@/src/components/AutocompleteDropdown';
import { AutocompleteTextField } from '@/src/components/AutocompleteTextField';
import { getOrganizationNames } from '@/src/features/organizations/organizationService';
import { LinkedResourcesField } from '@/src/components/LinkedResourcesField';
import {
  useLinkFields,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import { useOptionalFields } from '@/src/components/useOptionalFields';
import { toFhirLocalDateTime } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import {
  getDistinctDoctorNames,
  getDistinctServiceTypes,
} from './consultationService';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import type { Condition } from 'fhir/r5';
import { goBackOr } from '@/src/utils/navigation';
import { AIImportModal } from '@/src/components/AIImportModal';
import {
  buildConsultationAIInstructions,
  parseConsultationAIReply,
  type ImportedConsultation,
} from './consultationAIImport';
import { CONTENT_COLUMN } from '@/src/theme/layout';

export interface ConsultationStatusOption {
  id: string;
  label: string;
  status: string;
}

export const CONSULTATION_STATUS_OPTIONS: ConsultationStatusOption[] = [
  {
    id: 'completed',
    label: 'Completed',
    status: 'completed',
  },
  {
    id: 'planned',
    label: 'Planned',
    status: 'planned',
  },
];

export const COMMON_SERVICE_TYPES: string[] = [
  'Cardiology',
  'Dermatology',
  'Endocrinology',
  'Gastroenterology',
  'General practice',
  'Gynecology',
  'Hematology',
  'Neurology',
  'Oncology',
  'Ophthalmology',
  'Orthopedics',
  'Otolaryngology',
  'Pediatrics',
  'Psychiatry',
  'Pulmonology',
  'Radiology',
  'Rheumatology',
  'Surgery',
  'Urology',
];

export interface ConsultationFormValues {
  id?: string;
  title: string;
  status: string;
  date: Date;
  time?: string | null;
  doctorName?: string;
  serviceProviderName?: string;
  serviceType?: string;
  conditionIds?: string[];
  reasonConditionIds?: string[];
  diagnoses?: ConsultationDiagnosisInput[];
  notes?: string;
}

export interface ConsultationFormProps {
  initialValues?: Partial<ConsultationFormValues>;
  initialConditionIds?: string[];
  isEdit?: boolean;
  onSave: (
    values: ConsultationInput,
    links: Record<string, LinkSelection>
  ) => Promise<void>;
  /** Related resources this form can link to (edit only). */
  linkFields?: LinkFieldConfig[];
  /** Edits a record the AI proposed: the change goes back to its row, unsaved. */
  proposal?: boolean;
  /** Shown under a proposal's title, e.g. where in the document it came from. */
  proposalContext?: React.ReactNode;
}

function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

/** A diagnosis's optional fields, shown once added from its `+` or filled. */
type DiagnosisField = 'condition' | 'system' | 'code' | 'display';
const TERMINOLOGY_FIELDS = ['system', 'code', 'display'] as const;
const DIAGNOSIS_FIELD_LABELS: Record<DiagnosisField, string> = {
  condition: 'Referenced Condition',
  system: 'Terminology System',
  code: 'Diagnosis Code',
  display: 'Terminology Display',
};
const DIAGNOSIS_FIELDS: {
  id: DiagnosisField;
  label: string;
  icon: LucideIcon;
}[] = [
  {
    id: 'condition',
    label: DIAGNOSIS_FIELD_LABELS.condition,
    icon: FolderPlus,
  },
  { id: 'system', label: DIAGNOSIS_FIELD_LABELS.system, icon: Hash },
  { id: 'code', label: DIAGNOSIS_FIELD_LABELS.code, icon: Hash },
  { id: 'display', label: DIAGNOSIS_FIELD_LABELS.display, icon: Hash },
];
const menuIcon = (Icon: LucideIcon) => (
  <Icon size={20} color={COLORS.light.primary} style={{ marginRight: 12 }} />
);

export function ConsultationForm({
  initialValues,
  initialConditionIds,
  isEdit = false,
  onSave,
  linkFields = [],
  proposal = false,
  proposalContext,
}: ConsultationFormProps) {
  const links = useLinkFields(linkFields);
  const router = useRouter();
  const { activePatientId } = useActivePatient();

  const statusOptions = useMemo(() => {
    const existingStatus = initialValues?.status;
    if (
      !existingStatus ||
      CONSULTATION_STATUS_OPTIONS.some(
        (option) => option.status === existingStatus
      )
    )
      return CONSULTATION_STATUS_OPTIONS;
    return [
      ...CONSULTATION_STATUS_OPTIONS,
      {
        id: existingStatus,
        label: existingStatus.charAt(0).toUpperCase() + existingStatus.slice(1),
        status: existingStatus,
      },
    ];
  }, [initialValues?.status]);

  const [title, setTitle] = useState(initialValues?.title || '');
  const [selectedStatus, setSelectedStatus] =
    useState<ConsultationStatusOption>(() => {
      if (initialValues?.status) {
        const found = statusOptions.find(
          (s) =>
            s.status === initialValues.status || s.id === initialValues.status
        );
        if (found) return found;
      }
      return statusOptions[0]; // Completed
    });

  const [date, setDate] = useState<Date>(initialValues?.date || new Date());
  const [availableConditions, setAvailableConditions] = useState<Condition[]>(
    []
  );
  const conditionOptions = availableConditions.flatMap((condition) =>
    condition.id
      ? [{ id: condition.id, label: getConditionTitle(condition) }]
      : []
  );
  const fields = useOptionalFields({
    time: {
      label: 'Time',
      icon: Clock,
      empty: null as string | null,
      initial: initialValues?.time ?? null,
      added: () => {
        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
      },
    },
    conditions: {
      label: 'Reasons for Visit',
      icon: FolderPlus,
      testID: 'menu-add-condition',
      empty: [] as string[],
      initial: initialValues?.reasonConditionIds ?? initialConditionIds,
      available: conditionOptions.length > 0,
    },
    doctor: {
      label: 'Specialist',
      icon: User,
      empty: '',
      initial: initialValues?.doctorName,
    },
    serviceProvider: {
      label: 'Service provider',
      icon: Hospital,
      testID: 'menu-add-service-provider',
      empty: '',
      initial: initialValues?.serviceProviderName,
    },
    serviceType: {
      label: 'Service Type',
      icon: Activity,
      testID: 'menu-add-service-type',
      empty: '',
      initial: initialValues?.serviceType,
    },
    notes: {
      label: 'Notes',
      icon: FileText,
      empty: '',
      initial: initialValues?.notes,
    },
  });
  const {
    time,
    conditions: selectedConditionIds,
    doctor: doctorName,
    serviceProvider: serviceProviderName,
    serviceType,
    notes,
  } = fields.values;

  const [knownDoctors, setKnownDoctors] = useState<string[]>([]);
  const [knownServiceProviders, setKnownServiceProviders] = useState<string[]>(
    []
  );
  const [knownServiceTypes, setKnownServiceTypes] = useState<string[]>([]);
  const [diagnoses, setDiagnoses] = useState<ConsultationDiagnosisInput[]>(
    initialValues?.diagnoses || []
  );
  const [diagnosisQueries, setDiagnosisQueries] = useState<
    Record<number, string>
  >({});
  const hasChanges = useHasChanges({
    title,
    status: selectedStatus.id,
    date,
    time,
    doctorName,
    serviceProviderName,
    serviceType,
    notes,
    selectedConditionIds,
    diagnoses,
    links: links.values,
  });
  const [focusedDiagnosis, setFocusedDiagnosis] = useState<number | null>(null);
  const [shownDiagnosisFields, setShownDiagnosisFields] = useState<
    Record<number, DiagnosisField[]>
  >({});
  const [diagnosisOptions, setDiagnosisOptions] = useState<
    AddOptionItem[] | null
  >(null);
  const isDiagnosisFieldShown = (index: number, field: DiagnosisField) => {
    const diagnosis = diagnoses[index];
    const hasValue =
      field === 'condition'
        ? Boolean(
            diagnosis.conditionId ||
            diagnosis.createCondition ||
            diagnosisQueries[index]
          )
        : Boolean(diagnosis.terminology?.[field]);
    return hasValue || Boolean(shownDiagnosisFields[index]?.includes(field));
  };
  const showDiagnosisField = (index: number, field: DiagnosisField) =>
    setShownDiagnosisFields((current) => ({
      ...current,
      [index]: [...(current[index] || []), field],
    }));
  // Removing an optional field clears it and returns it to the `+` menu.
  const hideDiagnosisField = (index: number, field: DiagnosisField) => {
    setShownDiagnosisFields((current) => ({
      ...current,
      [index]: (current[index] || []).filter((shown) => shown !== field),
    }));
    setDiagnoses((current) =>
      current.map((entry, i) =>
        i !== index
          ? entry
          : field === 'condition'
            ? { ...entry, conditionId: undefined, createCondition: false }
            : { ...entry, terminology: { ...entry.terminology, [field]: '' } }
      )
    );
    if (field === 'condition') {
      setDiagnosisQueries((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      setFocusedDiagnosis(null);
    }
  };
  const removeDiagnosis = (index: number) => {
    // State kept per diagnosis moves up with the diagnoses after it.
    const shift = <T,>(record: Record<number, T>) =>
      Object.fromEntries(
        Object.entries(record).flatMap(([key, value]) => {
          const i = Number(key);
          return i === index ? [] : [[i > index ? i - 1 : i, value]];
        })
      ) as Record<number, T>;
    setDiagnoses((current) => current.filter((_, i) => i !== index));
    setShownDiagnosisFields(shift);
    setDiagnosisQueries(shift);
    setFocusedDiagnosis(null);
  };
  const diagnosisTextInputProps = (
    index: number,
    field: 'title' | (typeof TERMINOLOGY_FIELDS)[number],
    label: string
  ): TextInputProps => {
    const diagnosis = diagnoses[index];
    const isText = field === 'title' || field === 'display';
    return {
      testID: `diagnosis-${index}-${field}-input`,
      id: `diagnosis-${index}-${field}-input`,
      nativeID: `diagnosis-${index}-${field}-input`,
      ...{ name: `diagnosis${index}${field}` },
      accessibilityLabel: label,
      autoCapitalize: isText ? 'sentences' : 'none',
      autoCorrect: isText,
      value:
        field === 'title'
          ? diagnosis.title
          : diagnosis.terminology?.[field] || '',
      onFocus: () => setFocusedDiagnosis(null),
      onChangeText: (value) =>
        setDiagnoses((current) =>
          current.map((item, i) =>
            i !== index
              ? item
              : field === 'title'
                ? { ...item, title: value }
                : {
                    ...item,
                    terminology: { ...item.terminology, [field]: value },
                  }
          )
        ),
    };
  };
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load patient conditions, doctors, and service types
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAllConditions(activePatientId),
      getDistinctDoctorNames(activePatientId),
      getDistinctServiceTypes(activePatientId),
      getOrganizationNames(activePatientId),
    ])
      .then(
        ([conditionsData, doctorsData, serviceTypesData, providersData]) => {
          if (!isMounted) return;
          setAvailableConditions(conditionsData);
          setKnownDoctors(doctorsData);
          setKnownServiceProviders(providersData);
          setKnownServiceTypes(serviceTypesData);
        }
      )
      .catch((err) => {
        console.warn('Failed to load consultation context data:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  // Previously used service types first, then common ones.
  const serviceTypeSuggestions = useMemo(
    () => Array.from(new Set([...knownServiceTypes, ...COMMON_SERVICE_TYPES])),
    [knownServiceTypes]
  );

  /** Fills the form with the consultation read from the AI's reply, for review before saving. */
  const handleAIImport = (data: ImportedConsultation) => {
    setTitle(data.title);
    const status = statusOptions.find(
      (option) => option.status === data.status
    );
    if (status) setSelectedStatus(status);
    const [y, m, d] = data.date.split('-').map(Number);
    setDate(new Date(y, m - 1, d));
    fields.load({
      ...(data.time && { time: data.time }),
      ...(data.specialist && { doctor: data.specialist }),
      ...(data.serviceProvider && { serviceProvider: data.serviceProvider }),
      ...(data.serviceType && { serviceType: data.serviceType }),
      ...(data.notes && { notes: data.notes }),
    });
    if (data.diagnoses.length > 0) {
      setDiagnoses(data.diagnoses);
      setShownDiagnosisFields({});
      setDiagnosisQueries({});
      setFocusedDiagnosis(null);
    }
    setShowAIImport(false);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Required Field', 'Please enter a consultation title.');
      return;
    }

    if (diagnoses.some((diagnosis) => !diagnosis.title.trim())) {
      showAlert('Required Field', 'Please enter a diagnosis name.');
      return;
    }

    try {
      setIsSaving(true);
      const fullDate = toFhirLocalDateTime(date, time);

      await onSave(
        {
          id: initialValues?.id,
          title: trimmedTitle,
          status: selectedStatus.status,
          date: fullDate,
          doctorName: doctorName.trim() || undefined,
          // Removing a provider the consultation had clears it; otherwise an
          // unshown provider (e.g. a reference with no name) is kept.
          serviceProviderName: fields.shown.serviceProvider
            ? serviceProviderName.trim() || null
            : initialValues?.serviceProviderName
              ? null
              : undefined,
          serviceType: serviceType.trim() || undefined,
          reasonConditionIds: selectedConditionIds.filter(Boolean),
          diagnoses,
          notes: notes.trim() || undefined,
        },
        links.values
      );

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      // A proposal's view decides where to go once it is saved.
      if (!proposal)
        goBackOr(
          router,
          selectedConditionIds[0]
            ? `/condition/${selectedConditionIds[0]}`
            : '/'
        );
    } catch (err) {
      console.error('Failed to save consultation:', err);
      showAlert('Error', 'Failed to save consultation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Build list of options available in the '+' menu
  const plusMenuOptions: AddOptionItem[] = [
    {
      id: 'add-diagnosis',
      label: 'Diagnosis',
      icon: (
        <Stethoscope
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-diagnosis',
      onPress: () =>
        setDiagnoses((current) => [...current, { title: '', terminology: {} }]),
    },
  ];
  const menuOptions = [
    ...plusMenuOptions,
    ...fields.menuOptions,
    ...links.menuOptions,
  ];

  const { reveal, scrollViewProps } = useFieldReveal();

  return (
    <FieldRevealProvider value={reveal}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.keyboardContainer}>
          <ScrollView
            {...scrollViewProps}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <ScreenHeading testID="header-title">
              {proposal
                ? 'Edit Proposed Consultation'
                : isEdit
                  ? 'Edit Consultation'
                  : 'New Consultation'}
            </ScreenHeading>
            {proposalContext}
            {/* Consultation Title Input (Required) */}
            <FormField
              label="Consultation / Service"
              required
              nativeID="consultation-title-input"
              inputProps={{
                testID: 'consultation-title-input',
                id: 'consultation-title-input',
                nativeID: 'consultation-title-input',
                name: 'title',
                autoFocus: !isEdit,
                accessibilityLabel: 'Consultation Title',
                placeholder: 'e.g. Cardiology Follow-up, Annual Checkup',
                value: title,
                onChangeText: setTitle,
              }}
            />

            <FormField label="Status" nativeID="status-picker-select" required>
              <NativeSelect
                testID="status-picker-select"
                name="status"
                label="Consultation status"
                value={selectedStatus.id}
                options={statusOptions.map(({ id, label }) => ({ id, label }))}
                onChange={(value) => {
                  const found = statusOptions.find(
                    (option) => option.id === value
                  );
                  if (found) setSelectedStatus(found);
                }}
              />
            </FormField>

            {/* The date can be in the future (planned consultations). */}
            <FormField label="Date" nativeID="consultation-date" required>
              <NativeDatePicker
                value={date}
                onChange={(newDate) => {
                  if (newDate) setDate(newDate);
                }}
                allowFuture={true}
                testID="date-picker-button"
                id="consultation-date"
                name="date"
                variant="input"
              />
            </FormField>

            {time !== null && (
              <FormField
                label="Time"
                nativeID="consultation-time"
                removeTestID="remove-time-button"
                removeLabel="Remove time"
                onRemove={() => fields.remove('time')}
              >
                <NativeTimePicker
                  value={time}
                  onChange={(value) => fields.set('time', value)}
                  testID="time-picker-button"
                  id="consultation-time"
                  name="time"
                />
              </FormField>
            )}

            {fields.shown.conditions && (
              <LinkedResourcesField
                label="Reasons for visit"
                searchLabel="Select reasons for visit"
                options={conditionOptions}
                selectedIds={selectedConditionIds}
                onChange={(ids) => fields.set('conditions', ids)}
                testID="consultation-conditions-section"
                removeTestID="remove-conditions-section-button"
                onRemove={() => fields.remove('conditions')}
              />
            )}

            {diagnoses.length > 0 && (
              <FormField
                label="Diagnoses"
                testID="consultation-diagnoses-section"
                style={focusedDiagnosis !== null && styles.raised}
              >
                {diagnoses.map((diagnosis, index) => {
                  const hiddenFields = DIAGNOSIS_FIELDS.filter(
                    ({ id }) => !isDiagnosisFieldShown(index, id)
                  );
                  return (
                    <View
                      key={index}
                      style={[
                        styles.diagnosisItem,
                        focusedDiagnosis === index && styles.raised,
                      ]}
                      testID={`consultation-diagnosis-${index}`}
                    >
                      <GroupHeader
                        title={`Diagnosis ${index + 1}`}
                        idPrefix={`diagnosis-${index}`}
                        onAdd={
                          hiddenFields.length
                            ? () =>
                                setDiagnosisOptions(
                                  hiddenFields.map(({ id, label, icon }) => ({
                                    id,
                                    label,
                                    icon: menuIcon(icon),
                                    testID: `diagnosis-option-${id}`,
                                    onPress: () => {
                                      reveal.expectField();
                                      showDiagnosisField(index, id);
                                    },
                                  }))
                                )
                            : undefined
                        }
                        onRemove={() => removeDiagnosis(index)}
                      />
                      <FormField
                        label="Name"
                        required
                        nativeID={`diagnosis-${index}-title-input`}
                        inputProps={diagnosisTextInputProps(
                          index,
                          'title',
                          'Name'
                        )}
                      />
                      {isDiagnosisFieldShown(index, 'condition') && (
                        <FormField
                          label="Referenced Condition"
                          style={focusedDiagnosis === index && styles.raised}
                          nativeID={`diagnosis-${index}-condition-input`}
                          removeTestID={`remove-diagnosis-${index}-condition`}
                          onRemove={() =>
                            hideDiagnosisField(index, 'condition')
                          }
                          inputProps={{
                            testID: `diagnosis-${index}-condition-input`,
                            id: `diagnosis-${index}-condition-input`,
                            nativeID: `diagnosis-${index}-condition-input`,
                            name: `diagnosis${index}Condition`,
                            accessibilityLabel: 'Referenced Condition',
                            value:
                              diagnosisQueries[index] ??
                              (diagnosis.createCondition
                                ? 'New condition'
                                : availableConditions.find(
                                    (condition) =>
                                      condition.id === diagnosis.conditionId
                                  )?.code?.text || ''),
                            onChangeText: (query) => {
                              setDiagnosisQueries((current) => ({
                                ...current,
                                [index]: query,
                              }));
                              setFocusedDiagnosis(index);
                            },
                            onFocus: () => setFocusedDiagnosis(index),
                            onPressIn: () => setFocusedDiagnosis(index),
                          }}
                        >
                          {focusedDiagnosis === index && (
                            <AutocompleteDropdown
                              testID={`diagnosis-${index}-condition-list`}
                              itemTestIDPrefix={`diagnosis-${index}-condition-item-`}
                              items={[
                                ...availableConditions
                                  .filter((condition) =>
                                    getConditionTitle(condition)
                                      .toLowerCase()
                                      .includes(
                                        (
                                          diagnosisQueries[index] || ''
                                        ).toLowerCase()
                                      )
                                  )
                                  .map((condition) => ({
                                    id: condition.id!,
                                    label: getConditionTitle(condition),
                                  })),
                                {
                                  id: '__none__',
                                  label: 'No referenced condition',
                                },
                                {
                                  id: '__create__',
                                  label: 'New condition',
                                },
                              ]}
                              onSelect={(item) => {
                                setDiagnoses((current) =>
                                  current.map((entry, i) =>
                                    i !== index
                                      ? entry
                                      : {
                                          ...entry,
                                          conditionId: item.id.startsWith('__')
                                            ? undefined
                                            : item.id,
                                          createCondition:
                                            item.id === '__create__',
                                          title:
                                            entry.title ||
                                            (item.id.startsWith('__')
                                              ? ''
                                              : item.label),
                                        }
                                  )
                                );
                                setDiagnosisQueries((current) => {
                                  const next = { ...current };
                                  delete next[index];
                                  return next;
                                });
                                setFocusedDiagnosis(null);
                              }}
                            />
                          )}
                        </FormField>
                      )}
                      {TERMINOLOGY_FIELDS.filter((field) =>
                        isDiagnosisFieldShown(index, field)
                      ).map((field) => {
                        const label = DIAGNOSIS_FIELD_LABELS[field];
                        return (
                          <FormField
                            key={field}
                            label={label}
                            nativeID={`diagnosis-${index}-${field}-input`}
                            removeTestID={`remove-diagnosis-${index}-${field}`}
                            onRemove={() => hideDiagnosisField(index, field)}
                            inputProps={diagnosisTextInputProps(
                              index,
                              field,
                              label
                            )}
                          />
                        );
                      })}
                    </View>
                  );
                })}
              </FormField>
            )}

            {/* Service Type / Specialty Section (Optional) */}
            {fields.shown.serviceType && (
              <AutocompleteTextField
                label="Specialty / Service Type"
                name="serviceType"
                placeholder="e.g. Cardiology, General practice"
                accessibilityLabel="Specialty or Service Type"
                inputID="consultation-service-type-input"
                autocompleteTestID="service-type-autocomplete"
                value={serviceType}
                onChangeText={(value) => fields.set('serviceType', value)}
                suggestions={serviceTypeSuggestions}
                removeTestID="remove-service-type-button"
                removeLabel="Remove service type"
                onRemove={() => fields.remove('serviceType')}
              />
            )}

            {fields.shown.doctor && (
              <AutocompleteTextField
                label="Specialist"
                name="specialistName"
                placeholder="e.g. Dr. Sarah Adams"
                inputID="consultation-doctor-input"
                autocompleteTestID="doctor-autocomplete"
                value={doctorName}
                onChangeText={(value) => fields.set('doctor', value)}
                suggestions={knownDoctors}
                removeTestID="remove-doctor-button"
                onRemove={() => fields.remove('doctor')}
              />
            )}

            {fields.shown.serviceProvider && (
              <AutocompleteTextField
                label="Service provider"
                name="serviceProviderName"
                placeholder="e.g. City Hospital"
                inputID="consultation-service-provider-input"
                autocompleteTestID="service-provider-autocomplete"
                value={serviceProviderName}
                onChangeText={(value) => fields.set('serviceProvider', value)}
                suggestions={knownServiceProviders}
                removeTestID="remove-service-provider-button"
                onRemove={() => fields.remove('serviceProvider')}
              />
            )}

            {/* Consultation Notes Textarea (Optional) */}
            {fields.shown.notes && (
              <FormField
                label="Notes"
                nativeID="consultation-notes-input"
                removeTestID="remove-notes-button"
                onRemove={() => fields.remove('notes')}
                inputProps={{
                  testID: 'consultation-notes-input',
                  id: 'consultation-notes-input',
                  nativeID: 'consultation-notes-input',
                  name: 'notes',
                  accessibilityLabel: 'Notes',
                  placeholder:
                    'Add consultation notes, instructions, advice...',
                  multiline: true,
                  numberOfLines: 5,
                  value: notes,
                  onChangeText: (value) => fields.set('notes', value),
                }}
              />
            )}

            {links.fields}
            <FieldRevealSpace />
          </ScrollView>

          {/* Bottom Save Action */}
          <FormActionDock
            onAdd={() => setShowPlusMenu((visible) => !visible)}
            addExpanded={showPlusMenu}
            addDisabled={menuOptions.length === 0}
            addTestID="add-option-button"
            onSave={handleSubmit}
            saveLabel={proposal ? 'Save changes' : undefined}
            isSaving={isSaving}
            hasChanges={hasChanges}
            // New consultations can be filled in from the user's own AI assistant.
            secondaryActions={
              isEdit || proposal
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

          {/* Plus Menu Modal for adding optional fields */}
          <FloatingAddMenu
            testID="form-add-menu"
            visible={showPlusMenu}
            onClose={() => setShowPlusMenu(false)}
            options={menuOptions}
          />
          {/* A diagnosis's optional fields, from the + next to its heading */}
          <AddOptionsModal
            visible={Boolean(diagnosisOptions)}
            onClose={() => setDiagnosisOptions(null)}
            options={diagnosisOptions || []}
            overlayTestID="diagnosis-options-overlay"
            cardTestID="diagnosis-options-menu"
          />

          {showAIImport && (
            <AIImportModal
              document="consultation document"
              instructions={buildConsultationAIInstructions}
              parse={parseConsultationAIReply}
              onClose={() => setShowAIImport(false)}
              onImport={handleAIImport}
            />
          )}
        </View>
      </SafeAreaView>
    </FieldRevealProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.light.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    ...CONTENT_COLUMN,
    padding: 16,
    paddingBottom: 132,
  },
  diagnosisItem: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.light.border,
    paddingVertical: 16,
    marginBottom: 20,
  },
  // Lifts a field above later siblings while its autocomplete overlays them.
  raised: { zIndex: 10 },
});
