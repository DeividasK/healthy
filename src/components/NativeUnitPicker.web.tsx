import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { UnitOption } from '../data/cbcMarkers';

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
      <ChevronDown color="#717973" size={16} />
      {React.createElement(
        'select',
        {
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
    borderColor: '#c1c8c2',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flexShrink: 0,
  },
  unitPickerText: {
    fontSize: 13,
    color: '#1a1c1a',
    fontWeight: '600',
  },
});
