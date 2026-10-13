import React from 'react';
import {
  ActionSheetIOS,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { ConditionDropdownProps } from './ConditionDropdown.types';

export function ConditionDropdown({
  value,
  options,
  onChange,
  label,
  testID,
  name,
}: ConditionDropdownProps) {
  if (Platform.OS === 'ios')
    return (
      <TouchableOpacity
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{
          text: options.find((option) => option.id === value)?.label || value,
        }}
        style={[styles.container, styles.button]}
        onPress={() =>
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: label,
              options: [...options.map((option) => option.label), 'Cancel'],
              cancelButtonIndex: options.length,
            },
            (index) => {
              if (options[index]) onChange(options[index].id);
            }
          )
        }
      >
        <Text style={styles.text}>
          {options.find((option) => option.id === value)?.label || value}
        </Text>
        <ChevronDown size={18} color={COLORS.light.iconMuted} />
      </TouchableOpacity>
    );
  return (
    <View style={styles.container}>
      <Picker
        testID={testID}
        nativeID={testID}
        accessibilityLabel={label}
        {...{ name }}
        mode="dropdown"
        selectedValue={value}
        onValueChange={(next) => onChange(String(next))}
        style={styles.text}
        dropdownIconColor={COLORS.light.iconMuted}
      >
        {options.map((option) => (
          <Picker.Item key={option.id} label={option.label} value={option.id} />
        ))}
      </Picker>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
  },
  button: {
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: { fontSize: 16, color: COLORS.light.foreground },
});
