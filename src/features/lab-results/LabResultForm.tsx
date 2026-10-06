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
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, X, Clock, FileText } from 'lucide-react-native';
import { NativeDatePicker } from '../../components/NativeDatePicker';
import { NativeTimePicker } from '../../components/NativeTimePicker';
import { NativeUnitPicker } from '../../components/NativeUnitPicker';
import { PlusCircleButton } from '../../components/PlusCircleButton';
import { AddOptionsModal } from '../../components/AddOptionsModal';
import {
  CBC_MARKERS,
  CBCBiomarkerDefinition,
  searchCBCMarkers,
} from '../../data/cbcMarkers';
import { formatLocalDate } from '../../utils/dateUtils';
import { COLORS } from '../../theme/colors';
import {
  createAndSaveDiagnosticReport,
  BiomarkerInputItem,
  getReportById,
} from './diagnosticReportService';
import { useActivePatient } from '../profile/ActivePatientContext';

export interface ActiveMarkerItem {
  id: string;
  definition: CBCBiomarkerDefinition;
  valueStr: string;
  selectedUnit: string;
  selectedUcum: string;
}

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
}

export function LabResultForm({
  initialReportId,
  isEdit = false,
}: LabResultFormProps) {
  const router = useRouter();
  const { activePatientId } = useActivePatient();
  const reportId = initialReportId;

  // Test Date (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Optional Time & Notes
  const [testTime, setTestTime] = useState<string | null>(null);
  const [testNotes, setTestNotes] = useState<string | null>(null);
  const [showNotesInput, setShowNotesInput] = useState(false);

  // Plus menu dropdown
  const [showPlusMenu, setShowPlusMenu] = useState(false);

  // Active tests
  const [activeItems, setActiveItems] = useState<ActiveMarkerItem[]>([]);

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
            setTestTime(timePart.substring(0, 5));
          } else {
            const [y, m, d] = eff.split('-').map(Number);
            setSelectedDate(new Date(y, m - 1, d));
            setTestTime(null);
          }
        }

        // Notes
        if (record.report.note && record.report.note.length > 0) {
          setTestNotes(record.report.note.map((n) => n.text).join('\n'));
          setShowNotesInput(true);
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

            const def: CBCBiomarkerDefinition = CBC_MARKERS.find(
              (m) => m.loinc === loinc
            ) || {
              id: `marker_${loinc}`,
              name,
              aliases: [name],
              loinc,
              category: 'Complete Blood Count',
              primaryUnit: unit,
              ucumCode: ucum,
              units: [{ label: unit, ucum }],
              description: name,
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
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [reportId]);

  // Autocomplete matching items
  const autocompleteResults = useMemo(() => {
    const existingLoincs = new Set(
      activeItems.map((item) => item.definition.loinc)
    );
    const available = CBC_MARKERS.filter((m) => !existingLoincs.has(m.loinc));
    if (!searchQuery.trim()) {
      return available;
    }
    return searchCBCMarkers(searchQuery).filter(
      (m) => !existingLoincs.has(m.loinc)
    );
  }, [searchQuery, activeItems]);

  const hasTime = testTime !== null;
  const hasNotes = showNotesInput;
  const showPlusButton = !hasTime || !hasNotes;

  const handleSelectBiomarker = (marker: CBCBiomarkerDefinition) => {
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
        referenceLow: item.definition.referenceRange?.low,
        referenceHigh: item.definition.referenceRange?.high,
      }));

      await createAndSaveDiagnosticReport({
        reportId: isEdit ? initialReportId : undefined,
        patientId: activePatientId,
        date: effectiveDateStr,
        time: testTime || undefined,
        notes: testNotes ? testNotes.trim() : undefined,
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
          setTestTime(`${resetH}:${resetM}`);
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top App Header */}
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
          <Text style={styles.headerTitle}>{titleText}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top Pill Row: Date, Optional Time, Plus Action */}
          <View style={styles.pillRow}>
            {/* Native Date Picker */}
            <NativeDatePicker
              value={selectedDate}
              onChange={handleDateChange}
              testID="date-picker-button"
            />

            {/* Optional Time Pill */}
            {hasTime && (
              <NativeTimePicker
                value={testTime}
                onChange={setTestTime}
                onRemove={() => setTestTime(null)}
                maxTime={
                  formatLocalDate(selectedDate) === formatLocalDate(new Date())
                    ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`
                    : undefined
                }
                testID="time-picker-button"
              />
            )}

            {/* Plus Action Button */}
            {showPlusButton && (
              <PlusCircleButton
                testID="plus-menu-button"
                onPress={() => setShowPlusMenu(true)}
              />
            )}
          </View>

          {/* Optional Notes Section if added */}
          {showNotesInput && (
            <View style={styles.notesSection}>
              <View style={styles.notesHeader}>
                <Text style={styles.notesLabel}>Notes</Text>
                <TouchableOpacity
                  testID="remove-notes-button"
                  onPress={() => {
                    setShowNotesInput(false);
                    setTestNotes(null);
                  }}
                >
                  <X color={COLORS.light.iconClear} size={16} />
                </TouchableOpacity>
              </View>
              <TextInput
                testID="notes-input"
                id="notes-input"
                nativeID="notes-input"
                name="notes"
                accessibilityLabel="Report Notes"
                style={styles.notesInput}
                placeholder="Enter report notes (e.g., fasting, laboratory name)..."
                placeholderTextColor={COLORS.light.placeholder}
                multiline
                numberOfLines={3}
                value={testNotes || ''}
                onChangeText={setTestNotes}
              />
            </View>
          )}

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
              <View style={styles.autocompleteCard} testID="autocomplete-list">
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
        <View style={styles.bottomBar}>
          <TouchableOpacity
            testID="save-button"
            style={[
              styles.saveButton,
              (isSaving || activeItems.length === 0) &&
                styles.saveButtonDisabled,
            ]}
            disabled={isSaving || activeItems.length === 0}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plus Action Overlay ("Add Time", "Add Notes") */}
        <AddOptionsModal
          visible={showPlusMenu}
          onClose={() => setShowPlusMenu(false)}
          options={[
            ...(!hasTime
              ? [
                  {
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
                      const h = now.getHours().toString().padStart(2, '0');
                      const m = now.getMinutes().toString().padStart(2, '0');
                      setTestTime(`${h}:${m}`);
                    },
                  },
                ]
              : []),
            ...(!hasNotes
              ? [
                  {
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
                    onPress: () => {
                      setShowNotesInput(true);
                    },
                  },
                ]
              : []),
          ]}
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
    backgroundColor: COLORS.light.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    paddingBottom: 24,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 8,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.light.foreground,
    minHeight: 60,
    textAlignVertical: 'top',
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
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.light.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.border,
  },
  saveButton: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebPrimaryButton,
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 2,
      },
    }),
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: COLORS.light.primaryForeground,
    fontSize: 16,
    fontWeight: '700',
  },
});
