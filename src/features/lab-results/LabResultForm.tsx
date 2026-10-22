import { useHasChanges } from '@/src/components/useHasChanges';
import { FormActionDock } from '@/src/components/FormActionDock';
import { ScreenHeading } from '@/src/components/ScreenHeading';
import { FormField } from '@/src/components/FormField';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Clock, FileText, Hospital, Sparkles } from 'lucide-react-native';
import { NativeDatePicker } from '@/src/components/NativeDatePicker';
import { NativeTimePicker } from '@/src/components/NativeTimePicker';
import { NativeUnitPicker } from '@/src/components/NativeUnitPicker';
import { FloatingAddMenu } from '@/src/components/FloatingAddMenu';
import {
  FieldRevealProvider,
  useFieldReveal,
} from '@/src/components/FieldReveal';
import { AutocompleteTextField } from '@/src/components/AutocompleteTextField';
import {
  useLinkFields,
  type LinkFieldConfig,
} from '@/src/components/useLinkFields';
import { useOptionalFields } from '@/src/components/useOptionalFields';
import {
  getOrganizationNames,
  getServiceProviderName,
} from '@/src/features/organizations/organizationService';
import { isOrganizationReference } from '@/src/utils/fhirUtils';
import {
  RECORDABLE_BIOMARKERS,
  searchBiomarkers,
  type RecordableBiomarker,
} from '@/src/data/biomarkers';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';
import {
  createAndSaveDiagnosticReport,
  BiomarkerInputItem,
  getReportById,
  deleteReport,
} from './diagnosticReportService';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { ImportLabResultsModal } from './ImportLabResultsModal';
import type { ImportedLabResults } from './labResultsAIImport';

export interface ActiveMarkerItem {
  id: string;
  definition: RecordableBiomarker;
  valueStr: string;
  selectedUnit: string;
  selectedUcum: string;
}

/** Checks the selected local date and optional time against the current time. */
export function isDateTimeInFuture(
  date: Date,
  timeStr: string | null
): boolean {
  const now = new Date();
  const target = new Date(date);
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    target.setHours(h || 0, m || 0, 0, 0);
    return target.getTime() > now.getTime();
  }
  const todayEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  return target.getTime() > todayEnd.getTime();
}

/** Displays form feedback using the platform's alert implementation. */
function showAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

export interface LabResultFormProps {
  initialReportId?: string;
  isEdit?: boolean;
  /** Related resources this form can link to (edit only). */
  linkFields?: LinkFieldConfig[];
}

/** Creates or edits lab observations with reference bounds in their selected units. */
export function LabResultForm({
  initialReportId,
  isEdit = false,
  linkFields = [],
}: LabResultFormProps) {
  const router = useRouter();
  const links = useLinkFields(linkFields);
  const { activePatientId } = useActivePatient();
  const reportId = initialReportId;

  // Test Date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fields = useOptionalFields({
    time: {
      label: 'Time',
      icon: Clock,
      empty: null as string | null,
      added: () => {
        const now = new Date();
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        return `${h}:${m}`;
      },
    },
    serviceProvider: {
      label: 'Service provider',
      icon: Hospital,
      testID: 'menu-add-service-provider',
      empty: null as string | null,
      added: () => '',
    },
    notes: { label: 'Notes', icon: FileText, empty: '' },
  });
  const {
    time: testTime,
    serviceProvider: serviceProviderName,
    notes: testNotes,
  } = fields.values;
  const loadFields = fields.load;
  // Whether the loaded report showed a provider, so removing it is explicit.
  const [hadServiceProvider, setHadServiceProvider] = useState(false);
  const [knownServiceProviders, setKnownServiceProviders] = useState<string[]>(
    []
  );

  // Plus menu dropdown
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);

  // Active tests
  const [activeItems, setActiveItems] = useState<ActiveMarkerItem[]>([]);
  const [isReportLoaded, setIsReportLoaded] = useState(!reportId);
  const hasChanges = useHasChanges(
    {
      selectedDate,
      testTime,
      testNotes,
      serviceProviderName,
      activeItems: activeItems.map(({ id, valueStr, selectedUnit }) => ({
        id,
        valueStr,
        selectedUnit,
      })),
      links: links.values,
    },
    isReportLoaded
  );

  // Add Test search query
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [focusedMarkerId, setFocusedMarkerId] = useState<string | null>(null);
  const searchContainerRef = useRef<View>(null);

  // Load existing report if editing
  useEffect(() => {
    if (!reportId) return;

    let isMounted = true;
    (async () => {
      try {
        const record = await getReportById(reportId);
        if (!record || !isMounted) return;

        // Parse date and time from effectiveDateTime
        const eff = record.report.effectiveDateTime;
        if (eff) {
          if (eff.includes('T')) {
            const [datePart, timePart] = eff.split('T');
            const [y, m, d] = datePart.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, d));
            loadFields({ time: timePart.substring(0, 5) });
          } else {
            const [y, m, d] = eff.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, d));
            loadFields({ time: null });
          }
        }

        const providerName = await getServiceProviderName(
          record.report.performer?.find(isOrganizationReference),
          activePatientId
        );
        if (!isMounted) return;
        loadFields({ serviceProvider: providerName });
        setHadServiceProvider(providerName !== null);

        // Notes
        if (record.report.note && record.report.note.length > 0) {
          loadFields({
            notes: record.report.note.map((n) => n.text).join('\n'),
          });
        }

        // Map observations to activeItems
        const loadedItems: ActiveMarkerItem[] = record.observations.map(
          (obs) => {
            const loinc = obs.code.coding?.[0]?.code || '';
            const name =
              obs.code.coding?.[0]?.display || obs.code.text || 'Biomarker';
            const val =
              obs.valueQuantity?.value !== undefined
                ? obs.valueQuantity.value.toString()
                : '';
            const unit =
              obs.valueQuantity?.unit || obs.valueQuantity?.code || '';
            const ucum = obs.valueQuantity?.code || unit;

            const def: RecordableBiomarker = RECORDABLE_BIOMARKERS.find(
              (m) => m.loinc === loinc
            ) || {
              id: `marker_${loinc}`,
              name,
              aliases: [name],
              loinc,
              category: 'Other',
              primaryUnit: unit,
              ucumCode: ucum,
              units: [{ label: unit, ucum }],
              description: name,
              education: {
                about: '',
                whyItMatters: '',
                whatItMayAffect: '',
                whatMayBeRelatedToAChange: '',
              },
            };

            return {
              id: obs.id || `obs_${Date.now()}_${Math.random()}`,
              definition: def,
              valueStr: val,
              selectedUnit: unit,
              selectedUcum: ucum,
            };
          }
        );

        setActiveItems(loadedItems);
      } catch (err) {
        console.error('Failed to load report for editing:', err);
      } finally {
        if (isMounted) setIsReportLoaded(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [reportId, activePatientId, loadFields]);

  useEffect(() => {
    let isMounted = true;
    getOrganizationNames(activePatientId)
      .then((names) => {
        if (isMounted) setKnownServiceProviders(names);
      })
      .catch((err) => console.warn('Failed to load service providers:', err));
    return () => {
      isMounted = false;
    };
  }, [activePatientId]);

  // Autocomplete matching items
  const autocompleteResults = useMemo(() => {
    const existingLoincs = new Set(
      activeItems.map((item) => item.definition.loinc)
    );
    const available = RECORDABLE_BIOMARKERS.filter(
      (m) => !existingLoincs.has(m.loinc)
    );
    if (!searchQuery.trim()) {
      return available;
    }
    return searchBiomarkers(searchQuery).filter(
      (m) => !existingLoincs.has(m.loinc)
    );
  }, [searchQuery, activeItems]);

  const menuOptions = [...fields.menuOptions, ...links.menuOptions];

  /** Fills the form with results read from the AI's reply, for review before saving. */
  const handleAIImport = (data: ImportedLabResults) => {
    const [y, m, d] = data.date.split('-').map(Number);
    setSelectedDate(new Date(y, m - 1, d));
    loadFields({
      ...(data.time && { time: data.time }),
      ...(data.serviceProvider && { serviceProvider: data.serviceProvider }),
    });
    setActiveItems(
      data.results.map(({ marker, value, unit }) => ({
        id: marker.id,
        definition: marker,
        valueStr: value,
        selectedUnit: unit.label,
        selectedUcum: unit.ucum,
      }))
    );
    setSearchQuery('');
    setShowAIImport(false);
  };

  const handleSelectBiomarker = (marker: RecordableBiomarker) => {
    const defaultUnit = marker.units[0];
    const newItem: ActiveMarkerItem = {
      id: marker.id,
      definition: marker,
      valueStr: '',
      selectedUnit: defaultUnit ? defaultUnit.label : '',
      selectedUcum: defaultUnit ? defaultUnit.ucum : '',
    };
    setActiveItems((prev) => [...prev, newItem]);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleRemoveMarker = (index: number) => {
    setActiveItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleValueChange = (index: number, val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setActiveItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, valueStr: cleaned } : item
      )
    );
  };

  const handleSelectUnit = (index: number, unitLabel: string, ucum: string) => {
    setActiveItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, selectedUnit: unitLabel, selectedUcum: ucum }
          : item
      )
    );
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (activeItems.length === 0) {
      showAlert('Required', 'Please add at least one test result.');
      return;
    }

    for (const item of activeItems) {
      if (!item.valueStr.trim() || isNaN(Number(item.valueStr))) {
        showAlert(
          'Invalid Value',
          `Please provide a valid numeric value for ${item.definition.name}.`
        );
        return;
      }
    }

    if (isDateTimeInFuture(selectedDate, testTime)) {
      showAlert(
        'Invalid Date/Time',
        'Date and time cannot be set in the future.'
      );
      return;
    }

    try {
      setIsSaving(true);
      const effectiveDateStr = formatLocalDate(selectedDate);

      const biomarkers: BiomarkerInputItem[] = activeItems.map((item) => ({
        id: item.definition.id,
        name: item.definition.name,
        loinc: item.definition.loinc,
        value: parseFloat(item.valueStr),
        unit: item.selectedUnit,
        ucumCode: item.selectedUcum,
      }));

      await createAndSaveDiagnosticReport({
        reportId: isEdit ? initialReportId : undefined,
        patientId: activePatientId,
        date: effectiveDateStr,
        time: testTime || undefined,
        notes: testNotes ? testNotes.trim() : undefined,
        // Removing a provider the report had clears it; otherwise an unshown
        // provider (e.g. a reference with no name) is kept.
        serviceProviderName:
          serviceProviderName !== null
            ? serviceProviderName.trim() || null
            : hadServiceProvider
              ? null
              : undefined,
        serviceRequestIds: links.values['service-request']?.ids,
        items: biomarkers,
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (err) {
      console.error('Failed to save diagnostic report:', err);
      showAlert(
        'Save Error',
        'Failed to save report. Please check your inputs.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDateChange = (newDate: Date) => {
    setSelectedDate(newDate);
    if (testTime) {
      const now = new Date();
      const isToday =
        newDate.getFullYear() === now.getFullYear() &&
        newDate.getMonth() === now.getMonth() &&
        newDate.getDate() === now.getDate();

      if (isToday) {
        const [h, m] = testTime.split(':').map(Number);
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        if (h > currentH || (h === currentH && m > currentM)) {
          const resetH = currentH.toString().padStart(2, '0');
          const resetM = currentM.toString().padStart(2, '0');
          fields.set('time', `${resetH}:${resetM}`);
        }
      }
    }
  };

  const handleContainerFocus = () => {
    setIsSearchFocused(true);
  };

  const handleContainerBlur = (e: any) => {
    const nextTarget = e.relatedTarget;
    if (
      searchContainerRef.current &&
      (searchContainerRef.current as any).contains &&
      (searchContainerRef.current as any).contains(nextTarget)
    ) {
      return;
    }
    setIsSearchFocused(false);
    setFocusedMarkerId(null);
  };

  const titleText = isEdit || reportId ? 'Edit Lab Results' : 'Add Lab Results';

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
            <ScreenHeading>{titleText}</ScreenHeading>
            <FormField label="Date" nativeID="lab-result-date" required>
              <NativeDatePicker
                value={selectedDate}
                onChange={(date) => {
                  if (date) handleDateChange(date);
                }}
                testID="date-picker-button"
                id="lab-result-date"
                name="date"
                variant="input"
              />
            </FormField>

            {testTime !== null && (
              <FormField
                label="Time"
                nativeID="lab-result-time"
                removeTestID="remove-time-button"
                removeLabel="Remove time"
                onRemove={() => fields.remove('time')}
              >
                <NativeTimePicker
                  value={testTime}
                  onChange={(value) => fields.set('time', value)}
                  maxTime={
                    formatLocalDate(selectedDate) ===
                    formatLocalDate(new Date())
                      ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`
                      : undefined
                  }
                  testID="time-picker-button"
                  id="lab-result-time"
                  name="time"
                />
              </FormField>
            )}

            {serviceProviderName !== null && (
              <AutocompleteTextField
                label="Service provider"
                name="serviceProviderName"
                placeholder="e.g. City Laboratory"
                inputID="lab-result-service-provider-input"
                autocompleteTestID="service-provider-autocomplete"
                value={serviceProviderName}
                onChangeText={(value) => fields.set('serviceProvider', value)}
                suggestions={knownServiceProviders}
                removeTestID="remove-service-provider-button"
                onRemove={() => fields.remove('serviceProvider')}
              />
            )}

            {/* Optional Notes Section if added */}
            {fields.shown.notes && (
              <FormField
                label="Notes"
                nativeID="notes-input"
                removeTestID="remove-notes-button"
                onRemove={() => fields.remove('notes')}
                inputProps={{
                  testID: 'notes-input',
                  id: 'notes-input',
                  nativeID: 'notes-input',
                  name: 'notes',
                  accessibilityLabel: 'Report Notes',
                  placeholder:
                    'Enter report notes (e.g., fasting, laboratory name)...',
                  multiline: true,
                  numberOfLines: 3,
                  value: testNotes,
                  onChangeText: (value) => fields.set('notes', value),
                }}
              />
            )}

            {links.fields}

            {/* Active Tests List */}
            <View style={styles.activeTestsList}>
              {activeItems.map((item, index) => (
                <View
                  key={item.id}
                  style={styles.markerItem}
                  testID={`marker-card-${index}`}
                >
                  {/* Marker Header */}
                  <View style={styles.markerHeader}>
                    <Text style={styles.markerTitle} numberOfLines={1}>
                      {item.definition.name}
                    </Text>
                    <TouchableOpacity
                      testID={`remove-marker-${index}`}
                      style={styles.iconAction}
                      onPress={() => handleRemoveMarker(index)}
                    >
                      <X color={COLORS.light.iconClear} size={18} />
                    </TouchableOpacity>
                  </View>

                  {/* Input Row: = [value] [unit v] */}
                  <View style={styles.valueRow}>
                    <Text style={styles.equalsSign}>=</Text>
                    <TextInput
                      testID={`marker-value-input-${index}`}
                      id={`marker-value-input-${index}`}
                      nativeID={`marker-value-input-${index}`}
                      name={`marker-value-${item.id}`}
                      accessibilityLabel={item.definition.name}
                      style={styles.valueInput}
                      placeholder="Value"
                      placeholderTextColor={COLORS.light.placeholderInput}
                      keyboardType="decimal-pad"
                      value={item.valueStr}
                      onChangeText={(val) => handleValueChange(index, val)}
                    />
                    <NativeUnitPicker
                      testID={`unit-picker-button-${index}`}
                      selectedUnit={item.selectedUnit}
                      units={item.definition.units}
                      onSelect={(unitLabel, ucum) =>
                        handleSelectUnit(index, unitLabel, ucum)
                      }
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* Test Section */}
            <View
              ref={searchContainerRef}
              style={styles.addTestSection}
              onFocus={handleContainerFocus}
              onBlur={handleContainerBlur}
            >
              <Text style={styles.addTestLabel}>Select Test</Text>
              <View style={styles.searchInputContainer}>
                <TextInput
                  testID="test-search-input"
                  id="test-search-input"
                  nativeID="test-search-input"
                  name="test-search"
                  // New-resource forms start with their first field focused.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus={!isEdit && !reportId}
                  accessibilityLabel="Select Test"
                  style={styles.searchInput}
                  placeholder="Enter test, e.g., HbA1c, ASP..."
                  placeholderTextColor={COLORS.light.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity
                    testID="clear-search-button"
                    onPress={() => setSearchQuery('')}
                    style={styles.searchClearButton}
                  >
                    <X color={COLORS.light.iconClear} size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Autocomplete Dropdown */}
              {isSearchFocused && autocompleteResults.length > 0 && (
                <View
                  style={styles.autocompleteCard}
                  testID="autocomplete-list"
                >
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    nestedScrollEnabled
                    style={styles.autocompleteScroll}
                  >
                    {autocompleteResults.map((marker) => {
                      const isFocused = focusedMarkerId === marker.id;
                      return (
                        <TouchableOpacity
                          key={marker.id}
                          testID={`autocomplete-item-${marker.id}`}
                          style={[
                            styles.autocompleteItem,
                            isFocused && styles.autocompleteItemFocused,
                          ]}
                          onFocus={() => setFocusedMarkerId(marker.id)}
                          onBlur={() => {
                            if (focusedMarkerId === marker.id) {
                              setFocusedMarkerId(null);
                            }
                          }}
                          onPress={() => handleSelectBiomarker(marker)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.autocompleteItemName,
                              isFocused && styles.autocompleteItemNameFocused,
                            ]}
                          >
                            {marker.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Bottom Save Action */}
          <FormActionDock
            onAdd={() => setShowPlusMenu((visible) => !visible)}
            addExpanded={showPlusMenu}
            addDisabled={menuOptions.length === 0}
            addTestID="plus-menu-button"
            onSave={handleSave}
            isSaving={isSaving}
            saveDisabled={activeItems.length === 0}
            hasChanges={hasChanges}
            // New lab results can be filled in from the user's own AI assistant.
            secondaryActions={
              isEdit || reportId
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
            deleteLabel="Delete lab result"
            deleteTestID="delete-report-button"
            deleteConfirmation={
              isEdit && reportId
                ? {
                    title: 'Delete Lab Result',
                    message:
                      'Are you sure you want to delete this lab result? This action cannot be undone.',
                    onConfirm: async () => {
                      await deleteReport(reportId);
                      router.dismissTo('/');
                    },
                  }
                : undefined
            }
          />

          {/* Plus Action Overlay ("Add Time", "Add Service provider", "Add Notes") */}
          <FloatingAddMenu
            testID="form-add-menu"
            visible={showPlusMenu}
            onClose={() => setShowPlusMenu(false)}
            options={menuOptions}
          />

          {showAIImport && (
            <ImportLabResultsModal
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
    padding: 16,
    paddingBottom: 132,
  },
  activeTestsList: {
    gap: 16,
    marginBottom: 20,
  },
  markerItem: {
    width: '100%',
  },
  markerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  markerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    flex: 1,
    marginRight: 8,
  },
  iconAction: {
    padding: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  equalsSign: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
    marginRight: 2,
    flexShrink: 0,
  },
  valueInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.light.foreground,
    backgroundColor: COLORS.light.card,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  addTestSection: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 50,
  },
  addTestLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
    marginBottom: 6,
  },
  searchInputContainer: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 36,
    fontSize: 15,
    color: COLORS.light.foreground,
    backgroundColor: COLORS.light.card,
  },
  searchClearButton: {
    position: 'absolute',
    right: 10,
    padding: 4,
  },
  autocompleteCard: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    backgroundColor: COLORS.light.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    maxHeight: 220,
    zIndex: 100,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebModalCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  autocompleteScroll: {
    maxHeight: 220,
  },
  autocompleteItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.dropdownSeparator,
  },
  autocompleteItemFocused: {
    backgroundColor: COLORS.light.pillBackground,
  },
  autocompleteItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  autocompleteItemNameFocused: {
    color: COLORS.light.primary,
  },
});
