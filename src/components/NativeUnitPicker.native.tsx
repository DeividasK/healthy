import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  ActionSheetIOS,
  Alert,
} from 'react-native';
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
    } else if (Platform.OS === 'android') {
      Alert.alert(
        'Select Unit',
        undefined,
        [
          ...units.map((u) => ({
            text: u.label,
            onPress: () => onSelect(u.label, u.ucum),
          })),
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    }
  };

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
  },
  unitPickerText: {
    fontSize: 13,
    color: COLORS.light.foreground,
    fontWeight: '600',
  },
});
