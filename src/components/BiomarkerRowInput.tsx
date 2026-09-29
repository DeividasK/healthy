import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { Trash2, ArrowLeftRight, Activity } from 'lucide-react-native';
import { BiomarkerResult, BiomarkerDefinition } from '../types/health';
import { findBiomarkerByKey } from '../data/biomarker-catalog';
import { calculateBiomarkerStatus, getStatusBadgeConfig } from '../utils/units';
import { BiomarkerAutocomplete } from './BiomarkerAutocomplete';
import { useTranslation } from 'react-i18next';
import { getBiomarkerDisplayName } from '../i18n/biomarkers';

interface BiomarkerRowInputProps {
  item: BiomarkerResult;
  onChange: (updated: BiomarkerResult) => void;
  onDelete: () => void;
  index: number;
}

export function BiomarkerRowInput({
  item,
  onChange,
  onDelete,
  index,
}: BiomarkerRowInputProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'lt' ? 'lt' : 'en';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const definition: BiomarkerDefinition | undefined = useMemo(() => {
    if (!item.canonicalKey) return undefined;
    return findBiomarkerByKey(item.canonicalKey);
  }, [item.canonicalKey]);

  // Handle biomarker selection from autocomplete
  const handleSelectBiomarker = (def: BiomarkerDefinition) => {
    const isSI = def.primaryUnit === def.siUnit;
    const refInterval = isSI
      ? def.referenceIntervals.si
      : def.referenceIntervals.conventional;

    const newMin = refInterval?.min;
    const newMax = refInterval?.max;
    const initialStatus = calculateBiomarkerStatus(item.value, newMin, newMax);

    onChange({
      ...item,
      canonicalKey: def.canonicalKey,
      loinc: def.loinc,
      name: def.name,
      category: def.category,
      unit: def.primaryUnit,
      referenceMin: newMin,
      referenceMax: newMax,
      status: initialStatus,
    });
  };

  // Unit toggle between conventional and SI
  const canToggleUnit =
    definition &&
    definition.conventionalUnit &&
    definition.siUnit &&
    definition.conventionalUnit.toLowerCase() !== definition.siUnit.toLowerCase() &&
    definition.conversionFactor !== 1;

  const isCurrentConventional =
    definition &&
    item.unit.toLowerCase() === definition.conventionalUnit.toLowerCase();

  const targetUnit = definition
    ? isCurrentConventional
      ? definition.siUnit
      : definition.conventionalUnit
    : '';

  const handleToggleUnit = () => {
    if (!definition || !canToggleUnit) return;

    const isCurrentConv =
      item.unit.toLowerCase() === definition.conventionalUnit.toLowerCase();
    const nextUnit = isCurrentConv
      ? definition.siUnit
      : definition.conventionalUnit;
    const targetInterval = isCurrentConv
      ? definition.referenceIntervals.si
      : definition.referenceIntervals.conventional;

    let convertedVal = item.value;
    if (
      definition.conversionFactor &&
      item.value !== undefined &&
      !isNaN(item.value)
    ) {
      if (isCurrentConv) {
        // conventional -> SI
        convertedVal = Number(
          (item.value * definition.conversionFactor).toFixed(2)
        );
      } else {
        // SI -> conventional
        convertedVal = Number(
          (item.value / definition.conversionFactor).toFixed(2)
        );
      }
    }

    let updatedMin = targetInterval?.min;
    let updatedMax = targetInterval?.max;

    // Also convert customized reference interval values if user edited them
    if (definition.conversionFactor && definition.conversionFactor !== 1) {
      if (item.referenceMin !== undefined && !isNaN(item.referenceMin)) {
        updatedMin = isCurrentConv
          ? Number((item.referenceMin * definition.conversionFactor).toFixed(1))
          : Number((item.referenceMin / definition.conversionFactor).toFixed(1));
      }
      if (item.referenceMax !== undefined && !isNaN(item.referenceMax)) {
        updatedMax = isCurrentConv
          ? Number((item.referenceMax * definition.conversionFactor).toFixed(1))
          : Number((item.referenceMax / definition.conversionFactor).toFixed(1));
      }
    }

    const newStatus = calculateBiomarkerStatus(
      convertedVal,
      updatedMin,
      updatedMax
    );

    onChange({
      ...item,
      value: convertedVal,
      unit: nextUnit,
      referenceMin: updatedMin,
      referenceMax: updatedMax,
      status: newStatus,
    });
  };

  const handleValueChange = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange({
        ...item,
        value: undefined,
        status: 'unknown',
      });
      return;
    }

    const parsed = parseFloat(trimmed);
    if (isNaN(parsed)) {
      onChange({
        ...item,
        value: undefined,
        status: 'unknown',
      });
      return;
    }

    const newStatus = calculateBiomarkerStatus(
      parsed,
      item.referenceMin,
      item.referenceMax
    );

    onChange({
      ...item,
      value: parsed,
      status: newStatus,
    });
  };

  const handleMinChange = (text: string) => {
    const parsed = parseFloat(text);
    const newMin = isNaN(parsed) ? undefined : parsed;
    const newStatus = calculateBiomarkerStatus(
      item.value,
      newMin,
      item.referenceMax
    );

    onChange({
      ...item,
      referenceMin: newMin,
      status: newStatus,
    });
  };

  const handleMaxChange = (text: string) => {
    const parsed = parseFloat(text);
    const newMax = isNaN(parsed) ? undefined : parsed;
    const newStatus = calculateBiomarkerStatus(
      item.value,
      item.referenceMin,
      newMax
    );

    onChange({
      ...item,
      referenceMax: newMax,
      status: newStatus,
    });
  };

  const statusBadge = getStatusBadgeConfig(item.status);

  // If no biomarker is selected yet, render the search autocomplete
  if (!item.canonicalKey) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            borderColor: isDark ? '#334155' : '#E2E8F0',
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <Text
            style={[
              styles.rowNumber,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            Marker #{index + 1}
          </Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <BiomarkerAutocomplete
            onSelect={handleSelectBiomarker}
            autoFocus={true}
          />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
          borderColor: isDark ? '#334155' : '#E2E8F0',
        },
      ]}
    >
      {/* Header: Name, badges & Actions all inline */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.markerName,
              { color: isDark ? '#F8FAFC' : '#0F172A' },
            ]}
          >
            {getBiomarkerDisplayName(item, language)}
          </Text>

          <View
            style={[
              styles.categoryTag,
              { backgroundColor: isDark ? '#334155' : '#F1F5F9' },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: isDark ? '#CBD5E1' : '#475569' },
              ]}
            >
              {t(`biomarkers.categories.${item.category}`) || item.category}
            </Text>
          </View>

          {item.loinc && (
            <View style={styles.loincTag}>
              <Text style={styles.loincText}>LOINC: {item.loinc}</Text>
            </View>
          )}
        </View>

        <View style={styles.headerRight}>
          {canToggleUnit && Boolean(targetUnit) && (
            <TouchableOpacity
              style={[
                styles.unitToggleBtn,
                {
                  backgroundColor: isDark ? '#334155' : '#EFF6FF',
                  borderColor: isDark ? '#475569' : '#BFDBFE',
                },
              ]}
              onPress={handleToggleUnit}
            >
              <ArrowLeftRight size={13} color="#2563EB" />
              <Text style={styles.unitToggleText}>{targetUnit}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onDelete}
            style={styles.deleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={17} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Input Grid: Value + Range + Status */}
      <View style={styles.inputsGrid}>
        {/* Value Input */}
        <View style={styles.valueColumn}>
          <Text
            style={[
              styles.inputLabel,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            Result Value ({item.unit})
          </Text>
          <View
            style={[
              styles.valueInputWrapper,
              {
                backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                borderColor:
                  item.value !== undefined
                    ? statusBadge.border || (isDark ? '#334155' : '#CBD5E1')
                    : isDark
                    ? '#334155'
                    : '#CBD5E1',
              },
            ]}
          >
            <TextInput
              style={[
                styles.valueInput,
                { color: isDark ? '#F8FAFC' : '#0F172A' },
              ]}
              placeholder="Enter value"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="decimal-pad"
              value={item.value !== undefined ? String(item.value) : ''}
              onChangeText={handleValueChange}
            />
            {/* Live Flagging Badge only when value is typed */}
            {item.value !== undefined ? (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: statusBadge.bg,
                    borderColor: statusBadge.border,
                  },
                ]}
              >
                <Text
                  style={[styles.statusBadgeText, { color: statusBadge.color }]}
                >
                  {statusBadge.label}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.requiredBadge,
                  {
                    backgroundColor: isDark ? '#2D2012' : '#FEF3C7',
                    borderColor: isDark ? '#78350F' : '#FCD34D',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.requiredText,
                    { color: isDark ? '#FBBF24' : '#D97706' },
                  ]}
                >
                  Required
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Reference Range Inputs */}
        <View style={styles.rangeColumn}>
          <Text
            style={[
              styles.inputLabel,
              { color: isDark ? '#94A3B8' : '#64748B' },
            ]}
          >
            Reference Interval
          </Text>
          <View style={styles.rangeInputsRow}>
            <TextInput
              style={[
                styles.rangeInput,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                },
              ]}
              placeholder="Min"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="decimal-pad"
              value={
                item.referenceMin !== undefined ? String(item.referenceMin) : ''
              }
              onChangeText={handleMinChange}
            />
            <Text
              style={[
                styles.rangeSeparator,
                { color: isDark ? '#64748B' : '#94A3B8' },
              ]}
            >
              –
            </Text>
            <TextInput
              style={[
                styles.rangeInput,
                {
                  backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
                  borderColor: isDark ? '#334155' : '#CBD5E1',
                  color: isDark ? '#F8FAFC' : '#0F172A',
                },
              ]}
              placeholder="Max"
              placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
              keyboardType="decimal-pad"
              value={
                item.referenceMax !== undefined ? String(item.referenceMax) : ''
              }
              onChangeText={handleMaxChange}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  markerName: {
    fontSize: 15,
    fontWeight: '700',
  },
  categoryTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loincTag: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  loincText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  unitToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  deleteBtn: {
    padding: 4,
  },
  searchSection: {
    marginTop: 4,
  },
  rowNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputsGrid: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  valueColumn: {
    flex: 1,
    minWidth: 160,
  },
  rangeColumn: {
    flex: 1.3,
    minWidth: 200,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  valueInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
  },
  valueInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  requiredBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  requiredText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rangeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rangeInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
  },
  rangeSeparator: {
    fontSize: 16,
    fontWeight: '600',
  },
});
