import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS } from '@/src/theme/colors';

export interface NativeDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  testID?: string;
  variant?: 'pill' | 'input';
  id?: string;
  name?: string;
}

export function NativeDatePicker({
  value,
  onChange,
  placeholder = 'Not specified',
  testID = 'date-picker-button',
  variant = 'pill',
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
        onChange: (event, selectedDate) => {
          if (event.type === 'dismissed') {
            return;
          }
          if (selectedDate) {
            onChange(selectedDate);
          } else {
            onChange(null);
          }
        },
        mode: 'date',
        maximumDate: new Date(),
        is24Hour: true,
      });
    }
  };

  const isInput = variant === 'input';

  return (
    <TouchableOpacity
      style={isInput ? styles.dateInputContainer : styles.datePill}
      onPress={handlePress}
      activeOpacity={0.8}
      testID={testID}
    >
      <Calendar
        color={COLORS.light.iconMuted}
        size={18}
        style={styles.pillIcon}
      />
      <Text
        style={[
          isInput ? styles.dateInputText : styles.datePillText,
          !value && isInput && styles.placeholderText,
        ]}
      >
        {formattedDate}
      </Text>
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
    marginRight: 8,
  },
  datePillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
  },
  dateInputText: {
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  placeholderText: {
    color: COLORS.light.placeholder,
  },
});
