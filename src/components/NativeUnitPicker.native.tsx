import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ChevronDown } from 'lucide-react-native';
import { UnitOption } from '@/src/data/biomarkers';
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
  const handlePress = () => {
    if (Platform.OS === 'ios') {
      const options = [...units.map((u) => u.label), 'Cancel'];
      const cancelButtonIndex = options.length - 1;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex,
          title: 'Select Unit',
        },
        (buttonIndex) => {
          if (buttonIndex !== cancelButtonIndex && buttonIndex < units.length) {
            const selected = units[buttonIndex];
            onSelect(selected.label, selected.ucum);
          }
        }
      );
    }
  };

  // Android's alert dialog holds three buttons at most, so the units go in a
  // native single-choice dialog laid transparently over the button.
  if (Platform.OS === 'android') {
    return (
      <View style={styles.unitPickerButton} testID={testID}>
        <Text style={styles.unitPickerText}>{selectedUnit}</Text>
        <ChevronDown color={COLORS.light.iconClear} size={16} />
        <Picker
          testID={`${testID}-select`}
          nativeID={`${testID}-native-select`}
          accessibilityLabel="Select unit"
          {...{ name: `${testID}-unit` }}
          mode="dialog"
          prompt="Select Unit"
          selectedValue={selectedUnit}
          onValueChange={(label) => {
            const found = units.find((u) => u.label === label);
            if (found && found.label !== selectedUnit)
              onSelect(found.label, found.ucum);
          }}
          style={styles.overlayPicker}
        >
          {units.map((u) => (
            <Picker.Item
              key={u.ucum || u.label}
              label={u.label}
              value={u.label}
            />
          ))}
        </Picker>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.unitPickerButton}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={testID}
    >
      <Text style={styles.unitPickerText}>{selectedUnit}</Text>
      <ChevronDown color={COLORS.light.iconClear} size={16} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    position: 'relative',
  },
  overlayPicker: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0,
  },
  unitPickerText: {
    fontSize: 13,
    color: COLORS.light.foreground,
    fontWeight: '600',
  },
});
