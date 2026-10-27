import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { FormField } from '@/src/components/FormField';
import { NativeSelect } from '@/src/components/NativeSelect';
import { REGIONAL_RANGES } from '@/src/data/biomarkers';
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
}: {
  value: RangeRegion;
  /** True until the user picks a region themselves. */
  pickedFromDevice: boolean;
  onChange: (region: RangeRegion) => void;
}) {
  const chosen = getRangeRegionInfo(value);
  return (
    <>
      <Text
        style={styles.explanation}
        testID="settings-range-region-explanation"
      >
        {EXPLANATION}
        {pickedFromDevice && ` We picked ${chosen.name} from your device.`}
      </Text>
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
      <Text style={styles.bodies} testID="settings-range-region-bodies">
        {describeRegionRanges(value)}
      </Text>
    </>
  );
}

/** How many of a region's ranges are its own, and whose they are. */
function describeRegionRanges(region: RangeRegion) {
  const ranges = Object.values(REGIONAL_RANGES[region] ?? {});
  if (ranges.length === 0)
    return 'Uses the general ranges for every biomarker.';
  const sources = [...new Set(ranges.map(({ source }) => source.title))];
  return `Uses its own ranges for ${ranges.length} biomarkers, from ${sources.join(', ')}. Others use the general ranges.`;
}

const styles = StyleSheet.create({
  explanation: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.light.textSecondary,
    marginBottom: 16,
  },
  bodies: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.light.textSecondary,
    marginTop: -8,
    marginBottom: 20,
  },
});
