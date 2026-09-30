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
  Check,
} from 'lucide-react-native';
import { useLabReports } from '../src/context/LabReportsContext';
import { useTranslation } from 'react-i18next';
import { getBiomarkerDisplayName } from '../src/i18n/biomarkers';
import { BiomarkerResult, LabReport } from '../src/types/health';
import { BiomarkerRowInput } from '../src/components/BiomarkerRowInput';
import { calculateBiomarkerStatus } from '../src/utils/units';
import { useResponsive } from '../src/hooks/useResponsive';

export default function AddReportScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { reports, saveReport } = useLabReports();
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

            {/* Lab / Facility Name */}
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
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                  },
                ]}
                placeholder={t('addReport.labPlaceholder')}
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={labName}
                onChangeText={setLabName}
              />
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
});
