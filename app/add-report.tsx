import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
  KeyboardAvoidingView,
  useColorScheme,
  Modal,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Plus,
  Save,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  Check,
  Search,
} from 'lucide-react-native';
import { useLabReports } from '../src/context/LabReportsContext';
import { useUserProfile } from '../src/context/UserProfileContext';
import { useTranslation } from 'react-i18next';
import { getBiomarkerDisplayName } from '../src/i18n/biomarkers';
import { BiomarkerResult, LabReport } from '../src/types/health';
import { BiomarkerRowInput } from '../src/components/BiomarkerRowInput';
import { calculateBiomarkerStatus } from '../src/utils/units';
import { useResponsive } from '../src/hooks/useResponsive';

export default function AddReportScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { reports, saveReport } = useLabReports();
  const { availableLabs } = useUserProfile();
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { formMaxWidth, containerPadding } = useResponsive();

  const isEditing = Boolean(id);
  const existingReport = useMemo(
    () => (id ? reports.find((r) => r.id === id) : undefined),
    [id, reports]
  );

  const [testDate, setTestDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [labName, setLabName] = useState('');
  const [notes, setNotes] = useState('');
  const [markers, setMarkers] = useState<BiomarkerResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isLabModalOpen, setIsLabModalOpen] = useState(false);
  const [labSearch, setLabSearch] = useState('');

  const filteredLabs = useMemo(() => {
    const q = labSearch.trim().toLowerCase();
    if (!q) return availableLabs;
    return availableLabs.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.city && l.city.toLowerCase().includes(q))
    );
  }, [availableLabs, labSearch]);

  // Initialize if editing existing report
  useEffect(() => {
    if (existingReport) {
      setTestDate(existingReport.testDate);
      setLabName(existingReport.labName || '');
      setNotes(existingReport.notes || '');
      setMarkers(existingReport.markers || []);
    } else if (markers.length === 0) {
      // Add first blank row by default for frictionless start
      handleAddMarker();
    }
  }, [existingReport]);

  const handleAddMarker = () => {
    const newMarker: BiomarkerResult = {
      id: `marker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      canonicalKey: '',
      name: '',
      category: '',
      value: undefined,
      unit: '',
      status: 'unknown',
    };
    setMarkers((prev) => [...prev, newMarker]);
  };

  const handleUpdateMarker = (index: number, updated: BiomarkerResult) => {
    setMarkers((prev) => {
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const handleDeleteMarker = (index: number) => {
    setMarkers((prev) => prev.filter((_, i) => i !== index));
  };

  // Metrics summary
  const summary = useMemo(() => {
    const populated = markers.filter((m) => m.canonicalKey.trim().length > 0);
    const withValue = populated.filter(
      (m) => m.value !== undefined && !isNaN(m.value)
    );
    const normalCount = withValue.filter((m) => m.status === 'normal').length;
    const abnormalCount = withValue.filter(
      (m) => m.status === 'low' || m.status === 'high' || m.status === 'critical'
    ).length;

    return {
      total: populated.length,
      normalCount,
      abnormalCount,
    };
  }, [markers]);

  const handleSave = async () => {
    const selectedMarkers = markers.filter(
      (m) => m.canonicalKey.trim().length > 0
    );

    if (selectedMarkers.length === 0) {
      const msg = t('addReport.alertNoMarkersMsg');
      const title = t('addReport.alertNoMarkersTitle');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(title, msg);
      }
      return;
    }

    // Strictly disallow empty values for any selected biomarker
    const emptyMarkers = selectedMarkers.filter(
      (m) => m.value === undefined || isNaN(m.value) || m.value === null
    );

    if (emptyMarkers.length > 0) {
      const emptyNames = emptyMarkers
        .map((m) => getBiomarkerDisplayName(m, language) || 'Unnamed Marker')
        .join(', ');
      const msg = `${t('addReport.alertMissingValueMsg')}${emptyNames}`;
      const title = t('addReport.alertMissingValueTitle');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(title, msg);
      }
      return;
    }

    if (!testDate || !/^\d{4}-\d{2}-\d{2}$/.test(testDate.trim())) {
      const msg = t('addReport.alertInvalidDateMsg');
      const title = t('addReport.alertInvalidDateTitle');
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(title, msg);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Re-evaluate statuses just before saving
      const finalizedMarkers = selectedMarkers.map((m) => ({
        ...m,
        value: m.value as number,
        status: calculateBiomarkerStatus(m.value, m.referenceMin, m.referenceMax),
      }));

      const reportToSave: LabReport = {
        id: existingReport ? existingReport.id : `report_${Date.now()}`,
        testDate: testDate.trim(),
        labName: labName.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: existingReport
          ? existingReport.createdAt
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        markers: finalizedMarkers,
      };

      await saveReport(reportToSave);
      router.back();
    } catch (err: any) {
      const msg = err?.message || 'Failed to save report';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[
          styles.container,
          { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' },
        ]}
        contentContainerStyle={[
          styles.contentContainer,
          {
            maxWidth: formMaxWidth,
            paddingHorizontal: containerPadding,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Metadata Section */}
        <View
          style={[
            styles.metaCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
            },
          ]}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('addReport.reportInfo')}
          </Text>

          {/* Test Date & Lab Provider in a responsive row */}
          <View style={styles.metaRow}>
            {/* Test Date */}
            <View style={[styles.inputGroup, styles.dateInputGroup]}>
              <View style={styles.inputLabelRow}>
                <Calendar size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text
                  style={[
                    styles.inputLabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {t('addReport.testDate')}
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  },
                ]}
                placeholder={t('addReport.testDatePlaceholder')}
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={testDate}
                onChangeText={setTestDate}
                maxLength={10}
              />
            </View>

            {/* Lab / Facility Name Dropdown */}
            <View style={[styles.inputGroup, styles.labInputGroup]}>
              <View style={styles.inputLabelRow}>
                <Building2 size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text
                  style={[
                    styles.inputLabel,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {t('addReport.labLabel')}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.dropdownBtn,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                  },
                ]}
                onPress={() => setIsLabModalOpen(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownBtnLeft}>
                  <Building2
                    size={16}
                    color={
                      labName
                        ? '#2563EB'
                        : isDark
                        ? '#64748B'
                        : '#94A3B8'
                    }
                  />
                  <Text
                    style={[
                      styles.dropdownBtnText,
                      {
                        color: labName
                          ? isDark
                            ? '#F8FAFC'
                            : '#0F172A'
                          : isDark
                          ? '#64748B'
                          : '#94A3B8',
                        fontWeight: labName ? '600' : '400',
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {labName || t('addReport.labPlaceholder')}
                  </Text>
                </View>

                <View style={styles.dropdownBtnRight}>
                  {labName ? (
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        setLabName('');
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <X size={16} color={isDark ? '#94A3B8' : '#64748B'} />
                    </TouchableOpacity>
                  ) : (
                    <ChevronDown
                      size={18}
                      color={isDark ? '#94A3B8' : '#64748B'}
                    />
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Clinical Notes */}
          <View style={styles.inputGroup}>
            <View style={styles.inputLabelRow}>
              <FileText size={14} color={isDark ? '#94A3B8' : '#64748B'} />
              <Text
                style={[
                  styles.inputLabel,
                  { color: isDark ? '#94A3B8' : '#64748B' },
                ]}
              >
                {t('addReport.notesLabel')}
              </Text>
            </View>
            <TextInput
              style={[
                styles.textInput,
                styles.notesInput,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                },
              ]}
              placeholder={t('addReport.notesPlaceholder')}
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
            />
          </View>
        </View>

        {/* Biomarkers Section Header */}
        <View style={styles.markersHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {t('addReport.biomarkersTitle')} ({summary.total})
          </Text>

          {summary.total > 0 && (
            <View style={styles.summaryBadgesRow}>
              <View style={[styles.summaryBadge, styles.normalSummaryBadge]}>
                <CheckCircle2 size={12} color="#10B981" />
                <Text style={styles.normalSummaryText}>
                  {summary.normalCount} {t('common.normal')}
                </Text>
              </View>

              {summary.abnormalCount > 0 && (
                <View
                  style={[styles.summaryBadge, styles.abnormalSummaryBadge]}
                >
                  <AlertTriangle size={12} color="#EF4444" />
                  <Text style={styles.abnormalSummaryText}>
                    {summary.abnormalCount} {t('common.outOfRange')}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Biomarker Row Inputs */}
        {markers.map((marker, index) => (
          <BiomarkerRowInput
            key={marker.id}
            item={marker}
            index={index}
            onChange={(updated) => handleUpdateMarker(index, updated)}
            onDelete={() => handleDeleteMarker(index)}
          />
        ))}

        {/* Add Row Button */}
        <TouchableOpacity
          style={[
            styles.addMarkerBtn,
            {
              backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
              borderColor: '#2563EB',
            },
          ]}
          onPress={handleAddMarker}
        >
          <Plus size={18} color="#2563EB" />
          <Text style={styles.addMarkerText}>{t('addReport.addMarkerBtn')}</Text>
        </TouchableOpacity>

        {/* Save Report Primary Button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            isSubmitting && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={isSubmitting}
        >
          <Save size={20} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>
            {isSubmitting
              ? t('addReport.saving')
              : isEditing
              ? t('addReport.updateReportBtn')
              : t('addReport.saveReportBtn')}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Laboratory Selector Modal */}
      <Modal
        visible={isLabModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsLabModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? '#334155' : '#E2E8F0',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleGroup}>
                <Text
                  style={[
                    styles.modalTitle,
                    { color: isDark ? '#F8FAFC' : '#0F172A' },
                  ]}
                >
                  {t('addReport.selectLabTitle')}
                </Text>
                <Text
                  style={[
                    styles.modalSubtitle,
                    { color: isDark ? '#94A3B8' : '#64748B' },
                  ]}
                >
                  {t('addReport.selectLabSubtitle')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsLabModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={isDark ? '#94A3B8' : '#64748B'} />
              </TouchableOpacity>
            </View>

            {/* Modal Search Box */}
            <View
              style={[
                styles.modalSearchBox,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#E2E8F0',
                },
              ]}
            >
              <Search size={16} color={isDark ? '#94A3B8' : '#64748B'} />
              <TextInput
                style={[
                  styles.modalSearchInput,
                  { color: isDark ? '#F8FAFC' : '#0F172A' },
                ]}
                placeholder={t('addReport.searchLabPlaceholder')}
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={labSearch}
                onChangeText={setLabSearch}
                autoCorrect={false}
              />
              {labSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLabSearch('')}>
                  <X size={14} color={isDark ? '#94A3B8' : '#64748B'} />
                </TouchableOpacity>
              )}
            </View>

            {/* Clear / Unspecified option */}
            {labName.length > 0 && (
              <TouchableOpacity
                style={[
                  styles.clearLabOption,
                  {
                    borderBottomColor: isDark ? '#334155' : '#E2E8F0',
                  },
                ]}
                onPress={() => {
                  setLabName('');
                  setIsLabModalOpen(false);
                }}
              >
                <Text style={styles.clearLabOptionText}>
                  {t('addReport.clearLabSelection')}
                </Text>
              </TouchableOpacity>
            )}

            {/* List of laboratories */}
            <FlatList
              data={filteredLabs}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 6 }}
              renderItem={({ item }) => {
                const isSelected = labName === item.name;
                return (
                  <TouchableOpacity
                    style={[
                      styles.labModalItem,
                      isSelected && {
                        backgroundColor: isDark ? '#2563EB20' : '#EFF6FF',
                        borderColor: '#2563EB',
                      },
                      {
                        borderColor: isSelected
                          ? '#2563EB'
                          : isDark
                          ? '#334155'
                          : '#E2E8F0',
                      },
                    ]}
                    onPress={() => {
                      setLabName(item.name);
                      setIsLabModalOpen(false);
                      setLabSearch('');
                    }}
                  >
                    <View style={styles.labModalItemLeft}>
                      <View style={styles.labModalNameRow}>
                        <Text
                          style={[
                            styles.labModalName,
                            { color: isDark ? '#F8FAFC' : '#0F172A' },
                            isSelected && {
                              color: '#2563EB',
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {item.name}
                        </Text>
                      </View>
                      {item.description && (
                        <Text
                          style={[
                            styles.labModalDesc,
                            { color: isDark ? '#CBD5E1' : '#64748B' },
                          ]}
                        >
                          {item.description}
                        </Text>
                      )}
                      {item.city && (
                        <Text
                          style={[
                            styles.labModalCity,
                            { color: isDark ? '#94A3B8' : '#64748B' },
                          ]}
                        >
                          📍 {item.city}
                        </Text>
                      )}
                    </View>

                    {isSelected && <Check size={18} color="#2563EB" />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyLabsList}>
                  <Text
                    style={[
                      styles.emptyLabsText,
                      { color: isDark ? '#94A3B8' : '#64748B' },
                    ]}
                  >
                    {t('addReport.noLabsMatch')}
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 48,
    width: '100%',
    alignSelf: 'center',
  },
  metaCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  dateInputGroup: {
    flex: 1,
    minWidth: 160,
  },
  labInputGroup: {
    flex: 1.8,
    minWidth: 220,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  notesInput: {
    height: 64,
    textAlignVertical: 'top',
  },
  markersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  normalSummaryBadge: {
    backgroundColor: '#ECFDF5',
  },
  normalSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  abnormalSummaryBadge: {
    backgroundColor: '#FEF2F2',
  },
  abnormalSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  addMarkerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 20,
  },
  addMarkerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dropdownBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  dropdownBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  dropdownBtnRight: {
    paddingLeft: 4,
  },
  dropdownBtnText: {
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '80%',
    padding: 20,
    paddingBottom: 36,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  modalHeaderTitleGroup: {
    flex: 1,
    marginRight: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 14,
  },
  clearLabOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  clearLabOptionText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  labModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  labModalItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  labModalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  labModalName: {
    fontSize: 15,
    fontWeight: '600',
  },
  labModalDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  labModalCity: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyLabsList: {
    padding: 24,
    alignItems: 'center',
  },
  emptyLabsText: {
    fontSize: 13,
  },
});
