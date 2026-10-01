import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

export interface NativeDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  testID?: string;
}

export function NativeDatePicker({
  value,
  onChange,
  testID = 'date-picker-button',
}: NativeDatePickerProps) {
  const formattedDate = value.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handlePress = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
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
      <Calendar color="#414844" size={18} style={styles.pillIcon} />
      <Text style={styles.datePillText}>{formattedDate}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eeeeeb',
    borderWidth: 1,
    borderColor: '#c1c8c2',
    borderRadius: 9999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillIcon: {
    marginRight: 6,
  },
  datePillText: {
    color: '#1a1c1a',
    fontSize: 14,
    fontWeight: '600',
  },
});
