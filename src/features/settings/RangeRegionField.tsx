import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { FormField } from '@/src/components/FormField';
import { GroupHeader } from '@/src/components/GroupHeader';
import { NativeSelect } from '@/src/components/NativeSelect';
import { SelectedRowMarker } from '@/src/components/SelectedRowMarker';
import {
  RANGE_REGIONS,
  getRangeRegionInfo,
  type RangeRegion,
} from '@/src/data/biomarkers/rangeRegions';
import { COLORS } from '@/src/theme/colors';

const EXPLANATION =
  "Labs in different parts of the world use slightly different ranges, set by their medical bodies. Healthy uses the ranges for your region when your lab report doesn't include its own.";

/** The region whose biomarker ranges apply, with why it matters. */
export function RangeRegionField({
  value,
  pickedFromDevice,
  onChange,
  variant = 'a',
}: {
  value: RangeRegion;
  /** True until the user picks a region themselves. */
  pickedFromDevice: boolean;
  onChange: (region: RangeRegion) => void;
  variant?: 'a' | 'b' | 'c';
}) {
  const chosen = getRangeRegionInfo(value);
  const deviceNote = pickedFromDevice
    ? ` We picked ${chosen.name} from your device.`
    : '';
  return (
    <View style={styles.group}>
      <GroupHeader title="Biomarker Ranges" idPrefix="settings-ranges" />
      <Text style={styles.explanation} testID="settings-range-region-explanation">
        {EXPLANATION}
        {deviceNote}
      </Text>
      {variant !== 'c' && (
        <FormField label="Region" nativeID="settings-range-region" required>
          <NativeSelect
            value={value}
            options={RANGE_REGIONS.map(({ id, name }) => ({ id, label: name }))}
            onChange={(region) => onChange(region as RangeRegion)}
            label="Region"
            testID="settings-range-region"
            name="rangeRegion"
          />
        </FormField>
      )}
      {variant === 'a' && (
        <Text style={styles.bodies} testID="settings-range-region-bodies">
          Uses ranges from {chosen.bodies}, then International.
        </Text>
      )}
      {variant !== 'a' &&
        RANGE_REGIONS.map((region) => {
          const isChosen = region.id === value;
          const row = (
            <>
              {isChosen && <SelectedRowMarker />}
              <View style={styles.rowText}>
                <Text style={[styles.rowName, isChosen && styles.rowNameChosen]}>
                  {region.name}
                </Text>
                <Text style={styles.rowBodies}>{region.bodies}</Text>
              </View>
              {variant === 'c' && isChosen && (
                <Check size={18} color={COLORS.light.primary} />
              )}
            </>
          );
          return variant === 'c' ? (
            <Pressable
              key={region.id}
              onPress={() => onChange(region.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen }}
              testID={`settings-range-region-${region.id}`}
              style={styles.row}
            >
              {row}
            </Pressable>
          ) : (
            <View
              key={region.id}
              style={styles.row}
              aria-current={isChosen || undefined}
            >
              {row}
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginTop: 24,
  },
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.textSecondary,
    marginBottom: 16,
  },
  bodies: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.muted,
    marginTop: -8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.light.divider,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    color: COLORS.light.foreground,
  },
  rowNameChosen: {
    fontWeight: '600',
  },
  rowBodies: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.muted,
  },
});
