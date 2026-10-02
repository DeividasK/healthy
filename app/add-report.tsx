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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, X, Clock, FileText } from 'lucide-react-native';
import { NativeDatePicker } from '../src/components/NativeDatePicker';
import { NativeTimePicker } from '../src/components/NativeTimePicker';
import { NativeUnitPicker } from '../src/components/NativeUnitPicker';
import { PlusCircleButton } from '../src/components/PlusCircleButton';
import { AddOptionsModal } from '../src/components/AddOptionsModal';
import {
  CBC_MARKERS,
  CBCBiomarkerDefinition,
  searchCBCMarkers,
} from '../src/data/cbcMarkers';
import { formatLocalDate } from '../src/utils/dateUtils';
import { COLORS } from '../src/theme/colors';
import {
  createAndSaveDiagnosticReport,
  BiomarkerInputItem,
  getReportById,
} from '../src/services/diagnosticReportService';

interface ActiveMarkerItem {
  id: string;
  definition: CBCBiomarkerDefinition;
  valueStr: string;
  selectedUnit: string;
  selectedUcum: string;
}

/**
 * Checks if a given date and optional time is in the future.
 */
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

export default function AddLabResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const reportId = params.id;

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

            const def = CBC_MARKERS.find((m) => m.loinc === loinc) || {
              id: `marker_${loinc}`,
              name,
              aliases: [name],
              loinc,
              category: 'Complete Blood Count' as const,
              primaryUnit: unit,
              ucumCode: ucum,
              units: [{ label: unit, ucum }],
              description: name,
            };

            return {
              id: obs.id || `${def.id}_${Date.now()}`,
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

  // Manage focus and keyboard navigation: show dropdown when input or any dropdown item is focused;
  // hide dropdown when focus completely leaves the container.
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = searchContainerRef.current as unknown as HTMLElement;
    if (!container) return;

    const handleFocusIn = () => {
      setIsSearchFocused(true);
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (container && !container.contains(document.activeElement)) {
          setIsSearchFocused(false);
          setFocusedMarkerId(null);
        }
      }, 0);
    };

    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (container && !container.contains(target)) {
        setIsSearchFocused(false);
        setFocusedMarkerId(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchFocused(false);
        setFocusedMarkerId(null);
      }
    };

    container.addEventListener('focusin', handleFocusIn);
    container.addEventListener('focusout', handleFocusOut);
    container.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('touchstart', handleDocumentClick);

    return () => {
      container.removeEventListener('focusin', handleFocusIn);
      container.removeEventListener('focusout', handleFocusOut);
      container.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('touchstart', handleDocumentClick);
    };
  }, []);

  const handleContainerFocus = () => {
    setIsSearchFocused(true);
  };

  const handleContainerBlur = (e: any) => {
    if (Platform.OS === 'web') {
      const nextTarget = e.relatedTarget as HTMLElement | null;
      if (searchContainerRef.current) {
        const domNode = searchContainerRef.current as unknown as HTMLElement;
        if (domNode && nextTarget && domNode.contains(nextTarget)) {
          // Focus moved to another element inside the container
          return;
        }
      }
    }
    setIsSearchFocused(false);
    setFocusedMarkerId(null);
  };

  // Saving indicator
  const [isSaving, setIsSaving] = useState(false);

  // Filtered CBC markers for autocomplete (shows all when query is empty)
  const filteredMarkers = useMemo(() => {
    const alreadySelectedIds = new Set(
      activeItems.map((item) => item.definition.id)
    );
    const results = searchCBCMarkers(searchQuery);
    return results.filter((m) => !alreadySelectedIds.has(m.id));
  }, [searchQuery, activeItems]);

  const hasTime = Boolean(testTime);
  const hasNotes = Boolean(showNotesInput);
  const canAddMore = !hasTime || !hasNotes;

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const maxTimeForToday = isToday
    ? `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`
    : undefined;

  const handleDateChange = (newDate: Date) => {
    const now = new Date();
    const todayEnd = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );
    if (newDate.getTime() > todayEnd.getTime()) {
      showAlert('Invalid Date', 'Test date cannot be in the future.');
      return;
    }
    if (testTime && isDateTimeInFuture(newDate, testTime)) {
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      setTestTime(currentTime);
    }
    setSelectedDate(newDate);
  };

  const handleTimeChange = (newTime: string) => {
    const now = new Date();
    const isTargetToday = selectedDate.toDateString() === now.toDateString();
    if (isTargetToday) {
      const [h, m] = newTime.split(':').map(Number);
      const testDateWithTime = new Date(selectedDate);
      testDateWithTime.setHours(h, m, 0, 0);
      if (testDateWithTime.getTime() > now.getTime()) {
        showAlert('Invalid Time', 'Test time cannot be in the future.');
        return;
      }
    }
    setTestTime(newTime);
  };

  // Add a marker from search
  const handleSelectMarker = (marker: CBCBiomarkerDefinition) => {
    setActiveItems((prev) => [
      ...prev,
      {
        id: `${marker.id}_${Date.now()}`,
        definition: marker,
        valueStr: '',
        selectedUnit: marker.primaryUnit,
        selectedUcum: marker.ucumCode,
      },
    ]);
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Remove a marker
  const handleRemoveMarker = (index: number) => {
    setActiveItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update value of a marker
  const handleValueChange = (index: number, val: string) => {
    setActiveItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, valueStr: val } : item))
    );
  };

  // Unit change
  const handleSelectUnit = (index: number, unitLabel: string, ucum: string) => {
    setActiveItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, selectedUnit: unitLabel, selectedUcum: ucum }
          : item
      )
    );
  };

  // Save report
  const handleSave = async () => {
    if (activeItems.length === 0) {
      showAlert(
        'No Tests Added',
        'Please add at least one lab test result before saving.'
      );
      return;
    }

    // Validate that values are entered
    const invalidItems = activeItems.filter(
      (item) =>
        !item.valueStr.trim() ||
        isNaN(parseFloat(item.valueStr.replace(',', '.')))
    );

    if (invalidItems.length > 0) {
      showAlert(
        'Missing Values',
        `Please enter a valid numeric result for ${invalidItems[0].definition.name}.`
      );
      return;
    }

    // Validate that date and time are not in the future
    if (isDateTimeInFuture(selectedDate, testTime)) {
      showAlert(
        'Invalid Date or Time',
        'Test date or time cannot be in the future.'
      );
      return;
    }

    try {
      setIsSaving(true);
      const dateStr = formatLocalDate(selectedDate);

      const itemsToSave: BiomarkerInputItem[] = activeItems.map((item) => {
        const numVal = parseFloat(item.valueStr.replace(',', '.'));
        return {
          id: item.definition.id,
          name: item.definition.name,
          loinc: item.definition.loinc,
          value: numVal,
          unit: item.selectedUnit,
          ucumCode: item.selectedUcum,
          referenceLow: item.definition.referenceRange?.low,
          referenceHigh: item.definition.referenceRange?.high,
        };
      });

      await createAndSaveDiagnosticReport({
        reportId: reportId || undefined,
        date: dateStr,
        time: testTime || undefined,
        notes: testNotes || undefined,
        items: itemsToSave,
      });

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement)?.blur?.();
      }

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    } catch (err: any) {
      console.error('Error saving diagnostic report:', err);
      showAlert('Error', 'Failed to save lab results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

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
          <Text style={styles.headerTitle}>
            {reportId ? 'Edit Lab Results' : 'Add Lab Results'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => setIsSearchFocused(false)}
        >
          {/* Date & Action Row */}
          <View style={styles.dateActionRow}>
            {/* Native Date Picker Dropdown */}
            <NativeDatePicker
              value={selectedDate}
              onChange={handleDateChange}
              testID="date-picker-button"
            />

            {/* Native Time Picker Dropdown if set */}
            {testTime && (
              <NativeTimePicker
                value={testTime}
                onChange={handleTimeChange}
                onRemove={() => setTestTime(null)}
                maxTime={maxTimeForToday}
                testID="time-picker-button"
              />
            )}

            {/* Plus Button - only shown if either Time or Notes hasn't been added yet */}
            {canAddMore && (
              <PlusCircleButton
                testID="plus-menu-button"
                onPress={() => setShowPlusMenu(true)}
              />
            )}
          </View>

          {/* Notes display / input if enabled */}
          {showNotesInput && (
            <View style={styles.notesContainer}>
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

            {/* Dropdown with all options / filtered options */}
            {isSearchFocused && filteredMarkers.length > 0 && (
              <View
                style={styles.autocompleteContainer}
                testID="autocomplete-list"
              >
                <ScrollView
                  style={styles.autocompleteScroll}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredMarkers.map((marker) => (
                    <TouchableOpacity
                      key={marker.id}
                      testID={`autocomplete-item-${marker.id}`}
                      style={[
                        styles.autocompleteItem,
                        focusedMarkerId === marker.id &&
                          styles.autocompleteItemFocused,
                      ]}
                      onPress={() => handleSelectMarker(marker)}
                      onFocus={() => {
                        setIsSearchFocused(true);
                        setFocusedMarkerId(marker.id);
                      }}
                      onBlur={() => {
                        if (focusedMarkerId === marker.id) {
                          setFocusedMarkerId(null);
                        }
                      }}
                      activeOpacity={0.7}
                      accessible={true}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.autocompleteItemTitle,
                          focusedMarkerId === marker.id &&
                            styles.autocompleteItemTitleFocused,
                        ]}
                      >
                        {marker.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {isSearchFocused &&
              searchQuery.trim().length > 0 &&
              filteredMarkers.length === 0 && (
                <View style={styles.autocompleteEmpty}>
                  <Text style={styles.autocompleteEmptyText}>
                    No CBC markers match &quot;{searchQuery}&quot;.
                  </Text>
                </View>
              )}
          </View>
        </ScrollView>

        {/* Bottom Save Button (Anchored) */}
        <View style={styles.bottomSaveContainer}>
          <TouchableOpacity
            testID="save-button"
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
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
    color: COLORS.light.primaryForeground,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  dateActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillIcon: {
    marginRight: 6,
  },
  datePillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  pillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  notesContainer: {
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    padding: 12,
    marginBottom: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  notesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.textSecondary,
  },
  notesInput: {
    fontSize: 14,
    color: COLORS.light.foreground,
    minHeight: 48,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  markerTitle: {
    fontSize: 15,
    fontWeight: '700',
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
    borderColor: COLORS.light.pillBorder,
    borderRadius: 8,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.light.foreground,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  unitPickerButton: {
    height: 44,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 8,
    backgroundColor: COLORS.light.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  unitPickerText: {
    fontSize: 13,
    color: COLORS.light.foreground,
    fontWeight: '600',
  },
  addTestSection: {
    marginBottom: 24,
  },
  addTestLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 6,
  },
  searchInputContainer: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 8,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingRight: 36,
    fontSize: 15,
    color: COLORS.light.foreground,
  },
  searchClearButton: {
    position: 'absolute',
    right: 10,
    padding: 4,
  },
  autocompleteContainer: {
    backgroundColor: COLORS.light.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    marginTop: 4,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebDropdown,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
      },
    }),
  },
  autocompleteScroll: {
    maxHeight: 260,
  },
  autocompleteItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.light.dropdownSeparator,
  },
  autocompleteItemFocused: {
    backgroundColor: COLORS.light.dropdownHighlight,
  },
  autocompleteItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  autocompleteItemTitleFocused: {
    color: COLORS.light.primary,
    fontWeight: '700',
  },
  autocompleteEmpty: {
    padding: 12,
    backgroundColor: COLORS.light.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    marginTop: 4,
  },
  autocompleteEmptyText: {
    fontSize: 13,
    color: COLORS.light.muted,
    textAlign: 'center',
  },
  bottomSaveContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.light.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.light.cardBorder,
  },
  saveButton: {
    backgroundColor: COLORS.light.primary,
    height: 48,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebPrimaryButton,
      },
      default: {
        shadowColor: COLORS.light.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
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
