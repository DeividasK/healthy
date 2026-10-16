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
import type { NativeSelectProps } from './NativeSelect.types';

export function NativeSelect({
  compact = false,
  value,
  options,
  onChange,
  label,
  testID,
  name,
  disabled,
}: NativeSelectProps) {
  if (Platform.OS === 'ios')
    return (
      <TouchableOpacity
        testID={testID}
        disabled={disabled}
        id={testID}
        {...{ name }}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{
          text: options.find((option) => option.id === value)?.label || value,
        }}
        style={[
          styles.container,
          styles.button,
          compact && styles.compactButton,
        ]}
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
        <Text style={[styles.text, compact && styles.compactText]}>
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
        enabled={!disabled}
        accessibilityLabel={label}
        {...{ name }}
        mode="dropdown"
        selectedValue={value}
        onValueChange={(next) => onChange(String(next))}
        style={[styles.text, compact && styles.compactText]}
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
  compactButton: { minHeight: 44, paddingHorizontal: 8 },
  compactText: { fontSize: 13 },
  text: { fontSize: 16, color: COLORS.light.foreground },
});
