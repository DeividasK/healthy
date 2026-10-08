import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Clock, X } from 'lucide-react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { COLORS } from '@/src/theme/colors';

export interface NativeTimePickerProps {
  value: string; // "HH:mm"
  onChange: (time: string) => void;
  onRemove: () => void;
  maxTime?: string;
  testID?: string;
}

export function NativeTimePicker({
  value,
  onChange,
  onRemove,
  maxTime,
  testID = 'time-picker-button',
}: NativeTimePickerProps) {
  const handlePress = () => {
    if (Platform.OS === 'android') {
      const [hours, minutes] = value.split(':').map(Number);
      const now = new Date();
      now.setHours(hours || 9, minutes || 0, 0, 0);

      DateTimePickerAndroid.open({
        value: now,
        onChange: (_event, selectedDate) => {
          if (selectedDate) {
            const h = selectedDate.getHours().toString().padStart(2, '0');
            const m = selectedDate.getMinutes().toString().padStart(2, '0');
            const newTime = `${h}:${m}`;
            if (maxTime && newTime > maxTime) {
              return;
            }
            onChange(newTime);
          }
        },
        mode: 'time',
        is24Hour: true,
      });
    }
  };

  return (
    <View style={styles.timePill} testID={testID}>
      <TouchableOpacity
        style={styles.timePillInner}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Clock
          color={COLORS.light.iconMuted}
          size={16}
          style={styles.pillIcon}
        />
        <Text style={styles.pillText}>{value}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="remove-time-button"
        onPress={onRemove}
        style={styles.removeButton}
      >
        <X color={COLORS.light.iconClear} size={14} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.light.pillBackground,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  timePillInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  removeButton: {
    padding: 2,
  },
});
