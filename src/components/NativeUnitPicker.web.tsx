import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { UnitOption } from '@/src/data/cbcMarkers';
import { COLORS } from '@/src/theme/colors';

export interface NativeUnitPickerProps {
  selectedUnit: string;
  units: UnitOption[];
  onSelect: (unitLabel: string, ucum: string) => void;
  testID?: string;
}

export function NativeUnitPicker({
  selectedUnit,
  units,
  onSelect,
  testID = 'unit-picker-button',
}: NativeUnitPickerProps) {
  const handleChange = (e: any) => {
    const val = e.target?.value;
    const found = units.find((u) => u.label === val);
    if (found) {
      onSelect(found.label, found.ucum);
    }
  };

  return (
    <View style={styles.unitPickerButton} testID={testID}>
      <Text style={styles.unitPickerText}>{selectedUnit}</Text>
      <ChevronDown color={COLORS.light.iconClear} size={16} />
      {React.createElement(
        'select',
        {
          id: `${testID}-native-select`,
          name: `${testID}-unit`,
          value: selectedUnit,
          onChange: handleChange,
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
          'data-testid': `${testID}-select`,
        },
        units.map((u) =>
          React.createElement(
            'option',
            { key: u.ucum || u.label, value: u.label },
            u.label
          )
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  unitPickerButton: {
    position: 'relative',
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
});
