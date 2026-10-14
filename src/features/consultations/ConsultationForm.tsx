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
  Text,
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
  Stethoscope,
  ChevronDown,
  Clock,
  FileText,
  FolderPlus,
  User,
} from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  AddOptionsModal,
  AddOptionItem,
} from '@/src/components/AddOptionsModal';
import { AutocompleteDropdown } from '@/src/components/AutocompleteDropdown';
import { SpecialistField } from '@/src/components/SpecialistField';
import { LinkedResourcesField } from '@/src/components/LinkedResourcesField';
import {
  useLinkFields,
  type LinkFieldConfig,
  type LinkSelection,
} from '@/src/components/useLinkFields';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import { useSync } from '@/src/context/SyncContext';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { getAllConditions } from '@/src/features/conditions/conditionService';
import {
  getDistinctDoctorNames,
  getDistinctServiceTypes,
} from './consultationService';
import { getConditionTitle } from '@/src/utils/fhirUtils';
import type { Condition } from 'fhir/r5';
import { goBackOr } from '@/src/utils/navigation';

export interface ConsultationStatusOption {
  id: string;
  label: string;
  status: string;
  dotColor: string;
}

export const CONSULTATION_STATUS_OPTIONS: ConsultationStatusOption[] = [
  {
    id: 'completed',
    label: 'Completed',
    status: 'completed',
    dotColor: '#10B981',
  },
  {
    id: 'planned',
    label: 'Planned',
    status: 'planned',
    dotColor: '#3B82F6',
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
  onDelete?: () => Promise<void>;
  onSave: (
    values: ConsultationInput,
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

export function ConsultationForm({
  initialValues,
  initialConditionIds,
  isEdit = false,
  onSave,
  onDelete,
  linkFields = [],
}: ConsultationFormProps) {
  const links = useLinkFields(linkFields);
  const router = useRouter();
  const { triggerSync } = useSync();
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
        dotColor: COLORS.light.muted,
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
  const [time, setTime] = useState<string | null>(initialValues?.time ?? null);

  // Optional fields visibility and values
  const [showDoctor, setShowDoctor] = useState<boolean>(
    Boolean(initialValues?.doctorName)
  );
  const [doctorName, setDoctorName] = useState(initialValues?.doctorName || '');

  const [showServiceType, setShowServiceType] = useState<boolean>(
    Boolean(initialValues?.serviceType)
  );
  const [serviceType, setServiceType] = useState(
    initialValues?.serviceType || ''
  );

  const [showNotes, setShowNotes] = useState<boolean>(
    Boolean(initialValues?.notes)
  );
  const [notes, setNotes] = useState(initialValues?.notes || '');

  const [selectedConditionIds, setSelectedConditionIds] = useState<string[]>(
    initialValues?.reasonConditionIds ?? initialConditionIds ?? []
  );
  const [showCondition, setShowCondition] = useState(
    Boolean((initialValues?.reasonConditionIds ?? initialConditionIds)?.length)
  );

  const [availableConditions, setAvailableConditions] = useState<Condition[]>(
    []
  );
  const [knownDoctors, setKnownDoctors] = useState<string[]>([]);
  const [knownServiceTypes, setKnownServiceTypes] = useState<string[]>([]);
  const [isServiceTypeFocused, setIsServiceTypeFocused] = useState(false);
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
    serviceType,
    notes,
    selectedConditionIds,
    diagnoses,
    links: links.values,
  });
  const [focusedDiagnosis, setFocusedDiagnosis] = useState<number | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load patient conditions, doctors, and service types
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAllConditions(activePatientId),
      getDistinctDoctorNames(activePatientId),
      getDistinctServiceTypes(activePatientId),
    ])
      .then(([conditionsData, doctorsData, serviceTypesData]) => {
        if (!isMounted) return;
        setAvailableConditions(conditionsData);
        setKnownDoctors(doctorsData);
        setKnownServiceTypes(serviceTypesData);
      })
      .catch((err) => {
        console.warn('Failed to load consultation context data:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  // Autocomplete matching service types
  const matchingServiceTypes = useMemo(() => {
    const all = Array.from(
      new Set([...knownServiceTypes, ...COMMON_SERVICE_TYPES])
    );
    const trimmed = serviceType.trim().toLowerCase();
    if (!trimmed) {
      return all;
    }
    return all.filter((st) => st.toLowerCase().includes(trimmed));
  }, [serviceType, knownServiceTypes]);

  const handleStatusPress = () => {
    if (Platform.OS === 'ios') {
      const options = [...statusOptions.map((s) => s.label), 'Cancel'];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Select Status',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex) {
            setSelectedStatus(statusOptions[buttonIndex]);
          }
        }
      );
    } else if (Platform.OS === 'android') {
      setShowStatusModal(true);
    }
  };

  const conditionOptions = availableConditions.flatMap((condition) =>
    condition.id
      ? [{ id: condition.id, label: getConditionTitle(condition) }]
      : []
  );

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
      const formattedDate = formatLocalDate(date);
      const localDate = new Date(date);
      if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        localDate.setHours(hours, minutes, 0, 0);
      }
      const offset = -localDate.getTimezoneOffset();
      const zone = `${offset >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
      const fullDate = time
        ? `${formattedDate}T${time}:00${zone}`
        : formattedDate;

      await onSave(
        {
          id: initialValues?.id,
          title: trimmedTitle,
          status: selectedStatus.status,
          date: fullDate,
          doctorName:
            showDoctor && doctorName.trim() ? doctorName.trim() : undefined,
          serviceType:
            showServiceType && serviceType.trim()
              ? serviceType.trim()
              : undefined,
          reasonConditionIds: selectedConditionIds.filter(Boolean),
          diagnoses,
          notes: showNotes && notes.trim() ? notes.trim() : undefined,
        },
        links.values
      );

      triggerSync().catch((err) =>
        console.warn('Background sync failed on consultation change:', err)
      );

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      goBackOr(
        router,
        showCondition && selectedConditionIds[0]
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
  if (time === null) {
    plusMenuOptions.push({
      id: 'add-time',
      label: 'Time',
      icon: (
        <Clock
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-time',
      onPress: () => {
        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        setTime(`${hh}:${mm}`);
      },
    });
  }
  if (!showCondition && conditionOptions.length > 0) {
    plusMenuOptions.push({
      id: 'add-reason',
      label: 'Reasons for Visit',
      icon: (
        <FolderPlus
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-condition',
      onPress: () => setShowCondition(true),
    });
  }
  if (!showDoctor) {
    plusMenuOptions.push({
      id: 'add-doctor',
      label: 'Specialist',
      icon: (
        <User
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-doctor',
      onPress: () => setShowDoctor(true),
    });
  }
  if (!showServiceType) {
    plusMenuOptions.push({
      id: 'add-service-type',
      label: 'Service Type',
      icon: (
        <Activity
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-service-type',
      onPress: () => setShowServiceType(true),
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

  const menuOptions = [...plusMenuOptions, ...links.menuOptions];

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.keyboardContainer}>
        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeading testID="header-title">
            {isEdit ? 'Edit Consultation' : 'New Consultation'}
          </ScreenHeading>
          {/* Top Pill Row: Status, Date, Time, Plus Button */}
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
                    id: 'consultation-status-select',
                    name: 'status',
                    'aria-label': 'Consultation status',
                    value: selectedStatus.id,
                    onChange: (e: any) => {
                      const found = statusOptions.find(
                        (s) => s.id === e.target.value
                      );
                      if (found) setSelectedStatus(found);
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
                  statusOptions.map((opt) =>
                    React.createElement(
                      'option',
                      { key: opt.id, value: opt.id },
                      opt.label
                    )
                  )
                )}
            </TouchableOpacity>

            {/* Date Pill (can be in future, no validation on date) */}
            <NativeDatePicker
              value={date}
              onChange={(newDate) => {
                if (newDate) setDate(newDate);
              }}
              allowFuture={true}
              testID="date-picker-button"
            />

            {/* Optional Time Pill */}
            {time !== null && (
              <NativeTimePicker
                value={time}
                onChange={setTime}
                onRemove={() => setTime(null)}
                testID="time-picker-button"
              />
            )}

            {/* Plus Action Button */}
          </View>

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

          {showCondition && (
            <LinkedResourcesField
              label="Reasons for visit"
              searchLabel="Select reasons for visit"
              options={conditionOptions}
              selectedIds={selectedConditionIds}
              onChange={setSelectedConditionIds}
              testID="consultation-conditions-section"
              removeTestID="remove-conditions-section-button"
              onRemove={() => {
                setShowCondition(false);
                setSelectedConditionIds([]);
              }}
            />
          )}

          {diagnoses.length > 0 && (
            <FormField
              label="Diagnoses"
              testID="consultation-diagnoses-section"
              style={focusedDiagnosis !== null && styles.raised}
            >
              {diagnoses.map((diagnosis, index) => (
                <View
                  key={index}
                  style={[
                    styles.diagnosisItem,
                    focusedDiagnosis === index && styles.raised,
                  ]}
                  testID={`consultation-diagnosis-${index}`}
                >
                  {(['title', 'system', 'code', 'display'] as const).map(
                    (field) => {
                      const label =
                        field === 'title'
                          ? 'Diagnosis'
                          : field === 'system'
                            ? 'Terminology System (optional)'
                            : field === 'code'
                              ? 'Diagnosis Code (optional)'
                              : 'Terminology Display (optional)';
                      return (
                        <React.Fragment key={field}>
                          <FormField
                            label={label}
                            required={field === 'title'}
                            nativeID={`diagnosis-${index}-${field}-input`}
                            removeTestID={`remove-diagnosis-${index}`}
                            removeLabel={`Remove diagnosis ${index + 1}`}
                            onRemove={
                              field === 'title'
                                ? () =>
                                    setDiagnoses((current) =>
                                      current.filter((_, i) => i !== index)
                                    )
                                : undefined
                            }
                            inputProps={{
                              testID: `diagnosis-${index}-${field}-input`,
                              id: `diagnosis-${index}-${field}-input`,
                              nativeID: `diagnosis-${index}-${field}-input`,
                              name: `diagnosis${index}${field}`,
                              accessibilityLabel: label,
                              autoCapitalize:
                                field === 'title' || field === 'display'
                                  ? 'sentences'
                                  : 'none',
                              autoCorrect:
                                field === 'title' || field === 'display',
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
                                            terminology: {
                                              ...item.terminology,
                                              [field]: value,
                                            },
                                          }
                                  )
                                ),
                            }}
                          />
                          {field === 'title' && (
                            <FormField
                              label="Referenced Condition (optional)"
                              style={
                                focusedDiagnosis === index && styles.raised
                              }
                              nativeID={`diagnosis-${index}-condition-input`}
                              inputProps={{
                                testID: `diagnosis-${index}-condition-input`,
                                id: `diagnosis-${index}-condition-input`,
                                nativeID: `diagnosis-${index}-condition-input`,
                                name: `diagnosis${index}Condition`,
                                accessibilityLabel:
                                  'Referenced Condition (optional)',
                                value:
                                  diagnosisQueries[index] ??
                                  (diagnosis.createCondition
                                    ? 'Create new condition'
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
                                      label: 'Create new condition',
                                    },
                                  ]}
                                  onSelect={(item) => {
                                    setDiagnoses((current) =>
                                      current.map((entry, i) =>
                                        i !== index
                                          ? entry
                                          : {
                                              ...entry,
                                              conditionId: item.id.startsWith(
                                                '__'
                                              )
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
                        </React.Fragment>
                      );
                    }
                  )}
                </View>
              ))}
            </FormField>
          )}

          {/* Service Type / Specialty Section (Optional) */}
          {showServiceType && (
            <FormField
              label="Specialty / Service Type"
              style={isServiceTypeFocused && styles.raised}
              nativeID="consultation-service-type-input"
              removeTestID="remove-service-type-button"
              removeLabel="Remove service type"
              onRemove={() => {
                setShowServiceType(false);
                setServiceType('');
              }}
              inputProps={{
                testID: 'consultation-service-type-input',
                id: 'consultation-service-type-input',
                nativeID: 'consultation-service-type-input',
                name: 'serviceType',
                accessibilityLabel: 'Specialty or Service Type',
                placeholder: 'e.g. Cardiology, General practice',
                value: serviceType,
                onChangeText: (text) => {
                  setServiceType(text);
                  setIsServiceTypeFocused(true);
                },
                onFocus: () => setIsServiceTypeFocused(true),
              }}
            >
              {/* Service Type Autocomplete Suggestions */}
              {isServiceTypeFocused && matchingServiceTypes.length > 0 && (
                <AutocompleteDropdown
                  testID="service-type-autocomplete-list"
                  itemTestIDPrefix="service-type-autocomplete-item-"
                  items={matchingServiceTypes.map((st, idx) => ({
                    id: String(idx),
                    label: st,
                  }))}
                  onSelect={(item) => {
                    setServiceType(item.label);
                    setIsServiceTypeFocused(false);
                  }}
                />
              )}
            </FormField>
          )}

          {showDoctor && (
            <SpecialistField
              inputID="consultation-doctor-input"
              autocompleteTestID="doctor-autocomplete"
              value={doctorName}
              onChangeText={setDoctorName}
              suggestions={knownDoctors}
              removeTestID="remove-doctor-button"
              onRemove={() => {
                setShowDoctor(false);
                setDoctorName('');
              }}
            />
          )}

          {/* Consultation Notes Textarea (Optional) */}
          {showNotes && (
            <FormField
              label="Notes"
              nativeID="consultation-notes-input"
              removeTestID="remove-notes-button"
              onRemove={() => {
                setShowNotes(false);
                setNotes('');
              }}
              inputProps={{
                testID: 'consultation-notes-input',
                id: 'consultation-notes-input',
                nativeID: 'consultation-notes-input',
                name: 'notes',
                accessibilityLabel: 'Notes',
                placeholder: 'Add consultation notes, instructions, advice...',
                multiline: true,
                numberOfLines: 5,
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
          addDisabled={menuOptions.length === 0}
          addTestID="add-option-button"
          onSave={handleSubmit}
          isSaving={isSaving}
          cancelOnEscape={!isEdit}
          hasChanges={hasChanges}
          deleteLabel="Delete consultation"
          deleteTestID="delete-consultation-button"
          deleteConfirmation={
            isEdit && onDelete
              ? {
                  title: 'Delete Consultation',
                  message:
                    'Are you sure you want to delete this consultation? This action cannot be undone.',
                  onConfirm: onDelete,
                }
              : undefined
          }
        />

        {/* Plus Menu Modal for adding optional fields */}
        <FloatingAddMenu
          testID="form-add-menu"
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={menuOptions}
        />

        {/* Status Selection Modal for Android */}
        <AddOptionsModal
          visible={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          overlayTestID="status-menu-overlay"
          cardTestID="status-menu-card"
          options={statusOptions.map((opt) => ({
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
            onPress: () => setSelectedStatus(opt),
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
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
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
