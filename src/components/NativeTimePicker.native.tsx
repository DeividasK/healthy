import React from 'react';
import { Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Clock } from 'lucide-react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS } from '@/src/theme/colors';

export interface NativeTimePickerProps {
  value: string; // "HH:mm"
  onChange: (time: string) => void;
  maxTime?: string;
  testID?: string;
  id?: string;
  name?: string;
}

export function NativeTimePicker({
  value,
  onChange,
  maxTime,
  testID = 'time-picker-button',
  id,
  name,
}: NativeTimePickerProps) {
  const handlePress = () => {
    if (Platform.OS === 'android') {
      const [hours, minutes] = value.split(':').map(Number);
      const now = new Date();
      now.setHours(hours || 9, minutes || 0, 0, 0);

      DateTimePickerAndroid.open({
        value: now,
        onValueChange: (_event, selectedDate) => {
          const h = selectedDate.getHours().toString().padStart(2, '0');
          const m = selectedDate.getMinutes().toString().padStart(2, '0');
          const newTime = `${h}:${m}`;
          if (maxTime && newTime > maxTime) {
            return;
          }
          onChange(newTime);
        },
        mode: 'time',
        is24Hour: true,
      });
    }
  };

  return (
    <TouchableOpacity
      style={styles.timeInputContainer}
      onPress={handlePress}
      activeOpacity={0.8}
      testID={testID}
      id={id ?? testID}
      {...{ name }}
    >
      <Clock color={COLORS.light.iconMuted} size={18} style={styles.icon} />
      <Text style={styles.timeText}>{value}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  timeInputContainer: {
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
  icon: {
    marginRight: 8,
  },
  timeText: {
    fontSize: 16,
    color: COLORS.light.foreground,
  },
});
