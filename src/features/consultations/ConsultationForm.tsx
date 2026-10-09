import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronDown,
  Clock,
  FileText,
  FolderPlus,
  User,
  X,
} from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { PlusCircleButton } from '@/src/components/PlusCircleButton';
import {
  AddOptionsModal,
  AddOptionItem,
} from '@/src/components/AddOptionsModal';
import { AutocompleteDropdown } from '@/src/components/AutocompleteDropdown';
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

export interface ConsultationStatusOption {
  id: string;
  label: string;
  status: 'completed' | 'planned';
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
  conditionId?: string | null;
  notes?: string;
}

export interface ConsultationFormProps {
  initialValues?: Partial<ConsultationFormValues>;
  initialConditionId?: string | null;
  isEdit?: boolean;
  onSave: (values: {
    id?: string;
    title: string;
    status: string;
    date: string;
    doctorName?: string;
    serviceType?: string;
    conditionId?: string | null;
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

export function ConsultationForm({
  initialValues,
  initialConditionId,
  isEdit = false,
  onSave,
}: ConsultationFormProps) {
  const router = useRouter();
  const { triggerSync } = useSync();
  const { activePatientId } = useActivePatient();

  const [title, setTitle] = useState(initialValues?.title || '');
  const [selectedStatus, setSelectedStatus] =
    useState<ConsultationStatusOption>(() => {
      if (initialValues?.status) {
        const found = CONSULTATION_STATUS_OPTIONS.find(
          (s) =>
            s.status === initialValues.status || s.id === initialValues.status
        );
        if (found) return found;
      }
      return CONSULTATION_STATUS_OPTIONS[0]; // Completed
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

  // Associated condition selection (removable optional field)
  const initialCondId =
    initialValues?.conditionId !== undefined
      ? initialValues.conditionId
      : initialConditionId || null;
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(
    initialCondId
  );
  const [showCondition, setShowCondition] = useState<boolean>(
    Boolean(initialCondId)
  );

  const [availableConditions, setAvailableConditions] = useState<Condition[]>(
    []
  );
  const [knownDoctors, setKnownDoctors] = useState<string[]>([]);
  const [knownServiceTypes, setKnownServiceTypes] = useState<string[]>([]);
  const [isDoctorFocused, setIsDoctorFocused] = useState(false);
  const [isServiceTypeFocused, setIsServiceTypeFocused] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
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

  // Autocomplete matching doctors
  const matchingDoctors = useMemo(() => {
    const trimmed = doctorName.trim().toLowerCase();
    if (!trimmed) {
      return knownDoctors;
    }
    return knownDoctors.filter((doc) => doc.toLowerCase().includes(trimmed));
  }, [doctorName, knownDoctors]);

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

  const selectedConditionLabel = useMemo(() => {
    if (!selectedConditionId) return 'Select condition';
    const found = availableConditions.find((c) => c.id === selectedConditionId);
    return found ? getConditionTitle(found) : 'Select condition';
  }, [selectedConditionId, availableConditions]);

  const handleStatusPress = () => {
    if (Platform.OS === 'ios') {
      const options = [
        ...CONSULTATION_STATUS_OPTIONS.map((s) => s.label),
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
            setSelectedStatus(CONSULTATION_STATUS_OPTIONS[buttonIndex]);
          }
        }
      );
    } else if (Platform.OS === 'android') {
      setShowStatusModal(true);
    }
  };

  const handleConditionPress = () => {
    if (Platform.OS === 'ios') {
      const conditionOptions = [
        ...availableConditions.map((c) => getConditionTitle(c)),
        'Cancel',
      ];
      const cancelButtonIndex = conditionOptions.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: conditionOptions,
          cancelButtonIndex,
          title: 'Select Condition',
        },
        (buttonIndex) => {
          if (buttonIndex === cancelButtonIndex) return;
          const picked = availableConditions[buttonIndex];
          if (picked?.id) setSelectedConditionId(picked.id);
        }
      );
    } else if (Platform.OS === 'android') {
      setShowConditionModal(true);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showAlert('Required Field', 'Please enter a consultation title.');
      return;
    }

    try {
      setIsSaving(true);
      const formattedDate = formatLocalDate(date);
      const fullDate = time ? `${formattedDate}T${time}:00` : formattedDate;

      await onSave({
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
        conditionId: showCondition ? selectedConditionId : null,
        notes: showNotes && notes.trim() ? notes.trim() : undefined,
      });

      triggerSync().catch((err) =>
        console.warn('Background sync failed on consultation change:', err)
      );

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (router.canGoBack()) {
        router.back();
      } else if (showCondition && selectedConditionId) {
        router.replace(`/condition/${selectedConditionId}` as any);
      } else {
        router.replace('/');
      }
    } catch (err) {
      console.error('Failed to save consultation:', err);
      showAlert('Error', 'Failed to save consultation. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Build list of options available in the '+' menu
  const plusMenuOptions: AddOptionItem[] = [];
  if (time === null) {
    plusMenuOptions.push({
      id: 'add-time',
      label: 'Add Time',
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
  if (!showCondition) {
    plusMenuOptions.push({
      id: 'add-condition',
      label: 'Add Condition',
      icon: (
        <FolderPlus
          color={COLORS.light.primary}
          size={20}
          style={{ marginRight: 12 }}
        />
      ),
      testID: 'menu-add-condition',
      onPress: () => {
        setShowCondition(true);
        const targetId =
          selectedConditionId ||
          initialConditionId ||
          (availableConditions.length > 0 ? availableConditions[0].id : null);
        if (targetId) {
          setSelectedConditionId(targetId);
        }
      },
    });
  }
  if (!showDoctor) {
    plusMenuOptions.push({
      id: 'add-doctor',
      label: 'Add Doctor',
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
      label: 'Add Service Type',
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

  const conditionModalOptions = availableConditions.map((c) => ({
    id: c.id || 'cond',
    label: getConditionTitle(c),
    icon: (
      <FolderPlus
        color={COLORS.light.primary}
        size={18}
        style={{ marginRight: 12 }}
      />
    ),
    testID: `condition-option-${c.id}`,
    onPress: () => setSelectedConditionId(c.id || null),
  }));

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
          <Text style={styles.headerTitle} testID="header-title">
            {isEdit ? 'Edit Consultation' : 'New Consultation'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Pill Row: Status, Date, Time, Condition, Plus Button */}
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
                      const found = CONSULTATION_STATUS_OPTIONS.find(
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
                  CONSULTATION_STATUS_OPTIONS.map((opt) =>
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

            {/* Optional Condition Association Pill */}
            {showCondition && (
              <View style={styles.conditionPill}>
                <TouchableOpacity
                  testID="condition-picker-button"
                  style={styles.conditionPillTouchable}
                  onPress={handleConditionPress}
                  activeOpacity={0.8}
                >
                  <FolderPlus
                    color={COLORS.light.iconMuted}
                    size={15}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={styles.conditionPillText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {selectedConditionLabel}
                  </Text>
                  <ChevronDown
                    color={COLORS.light.iconClear}
                    size={16}
                    style={{ marginLeft: 4 }}
                  />

                  {Platform.OS === 'web' &&
                    React.createElement(
                      'select',
                      {
                        id: 'consultation-condition-select',
                        name: 'conditionId',
                        'aria-label': 'Associated condition',
                        value: selectedConditionId || '',
                        onChange: (e: any) => {
                          const val = e.target.value;
                          setSelectedConditionId(val ? val : null);
                        },
                        style: {
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 28,
                          bottom: 0,
                          opacity: 0,
                          width: 'calc(100% - 28px)',
                          height: '100%',
                          cursor: 'pointer',
                          zIndex: 10,
                        },
                        'data-testid': 'condition-picker-select',
                      },
                      availableConditions.map((cond) =>
                        React.createElement(
                          'option',
                          { key: cond.id, value: cond.id },
                          getConditionTitle(cond)
                        )
                      )
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                  testID="remove-condition-button"
                  onPress={() => {
                    setShowCondition(false);
                    setSelectedConditionId(null);
                  }}
                  style={styles.removePillButton}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Remove condition"
                >
                  <X color={COLORS.light.iconClear} size={14} />
                </TouchableOpacity>
              </View>
            )}

            {/* Plus Action Button */}
            {plusMenuOptions.length > 0 && (
              <PlusCircleButton
                testID="add-option-button"
                onPress={() => setShowPlusMenu(true)}
              />
            )}
          </View>

          {/* Consultation Title Input (Required) */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Consultation / Service</Text>
            <TextInput
              testID="consultation-title-input"
              id="consultation-title-input"
              nativeID="consultation-title-input"
              name="title"
              accessibilityLabel="Consultation Title"
              style={styles.textInput}
              placeholder="e.g. Cardiology Follow-up, Annual Checkup"
              placeholderTextColor={COLORS.light.placeholder}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Service Type / Specialty Section (Optional) */}
          {showServiceType && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>
                  Specialty / Service Type (Optional)
                </Text>
                <TouchableOpacity
                  testID="remove-service-type-button"
                  onPress={() => {
                    setShowServiceType(false);
                    setServiceType('');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Remove service type"
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="consultation-service-type-input"
                id="consultation-service-type-input"
                nativeID="consultation-service-type-input"
                name="serviceType"
                accessibilityLabel="Specialty or Service Type"
                style={styles.textInput}
                placeholder="e.g. Cardiology, General practice"
                placeholderTextColor={COLORS.light.placeholder}
                value={serviceType}
                onChangeText={(text) => {
                  setServiceType(text);
                  setIsServiceTypeFocused(true);
                }}
                onFocus={() => setIsServiceTypeFocused(true)}
              />

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
            </View>
          )}

          {/* Doctor / Specialist Input with Autocomplete (Optional) */}
          {showDoctor && (
            <View style={styles.inputSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>
                  Doctor or Specialist (Optional)
                </Text>
                <TouchableOpacity
                  testID="remove-doctor-button"
                  onPress={() => {
                    setShowDoctor(false);
                    setDoctorName('');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Remove doctor"
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <View style={styles.doctorInputContainer}>
                <TextInput
                  testID="consultation-doctor-input"
                  id="consultation-doctor-input"
                  nativeID="consultation-doctor-input"
                  name="doctorName"
                  accessibilityLabel="Doctor or Specialist"
                  style={styles.textInput}
                  placeholder="e.g. Dr. Sarah Adams"
                  placeholderTextColor={COLORS.light.placeholder}
                  value={doctorName}
                  onChangeText={(text) => {
                    setDoctorName(text);
                    setIsDoctorFocused(true);
                  }}
                  onFocus={() => setIsDoctorFocused(true)}
                />
                {doctorName.length > 0 && (
                  <TouchableOpacity
                    testID="clear-doctor-button"
                    onPress={() => setDoctorName('')}
                    style={styles.clearDoctorButton}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Clear doctor name"
                  >
                    <X color={COLORS.light.iconClear} size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Doctor Autocomplete Suggestions */}
              {isDoctorFocused && matchingDoctors.length > 0 && (
                <AutocompleteDropdown
                  testID="doctor-autocomplete-list"
                  itemTestIDPrefix="doctor-autocomplete-item-"
                  items={matchingDoctors.map((doc, idx) => ({
                    id: String(idx),
                    label: doc,
                  }))}
                  onSelect={(item) => {
                    setDoctorName(item.label);
                    setIsDoctorFocused(false);
                  }}
                />
              )}
            </View>
          )}

          {/* Consultation Notes Textarea (Optional) */}
          {showNotes && (
            <View style={styles.descriptionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TouchableOpacity
                  testID="remove-notes-button"
                  onPress={() => {
                    setShowNotes(false);
                    setNotes('');
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Remove notes"
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="consultation-notes-input"
                id="consultation-notes-input"
                nativeID="consultation-notes-input"
                name="notes"
                accessibilityLabel="Notes"
                style={styles.descriptionInput}
                placeholder="Add consultation notes, instructions, advice..."
                placeholderTextColor={COLORS.light.placeholder}
                multiline
                numberOfLines={5}
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

        {/* Plus Menu Modal for adding optional fields */}
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
          options={CONSULTATION_STATUS_OPTIONS.map((opt) => ({
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

        {/* Condition Selection Modal for Android */}
        <AddOptionsModal
          visible={showConditionModal}
          onClose={() => setShowConditionModal(false)}
          overlayTestID="condition-menu-overlay"
          cardTestID="condition-menu-card"
          options={conditionModalOptions}
        />
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.light.primary,
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
    paddingBottom: 40,
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
  conditionPill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 220,
  },
  conditionPillTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.light.foreground,
    maxWidth: 120,
  },
  removePillButton: {
    padding: 4,
    marginLeft: 4,
    zIndex: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  textInput: {
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.light.foreground,
  },
  doctorInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  clearDoctorButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionInput: {
    backgroundColor: COLORS.light.card,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.light.foreground,
    minHeight: 110,
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
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: COLORS.light.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
});
