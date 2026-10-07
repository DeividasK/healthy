import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS } from '../theme/colors';

export interface NativeDatePickerProps {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  testID?: string;
}

export function NativeDatePicker({
  value,
  onChange,
  placeholder = 'Not specified',
  testID = 'date-picker-button',
}: NativeDatePickerProps) {
  const formattedDate = value
    ? value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : placeholder;

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: value || new Date(),
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            onChange(selectedDate);
          }
        },
        mode: 'date',
        maximumDate: new Date(),
        is24Hour: true,
      });
    }
  };

  return (
    <TouchableOpacity
      style={styles.datePill}
      onPress={handlePress}
      activeOpacity={0.8}
      testID={testID}
    >
      <Calendar
        color={COLORS.light.iconMuted}
        size={18}
        style={styles.pillIcon}
      />
      <Text style={styles.datePillText}>{formattedDate}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillIcon: {
    marginRight: 6,
  },
  datePillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
});
