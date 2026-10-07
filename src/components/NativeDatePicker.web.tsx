import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { formatLocalDate } from '../utils/dateUtils';
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
  const inputRef = useRef<any>(null);

  const formattedDate = value
    ? value.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : placeholder;

  const dateValueStr = value ? formatLocalDate(value) : '';

  const todayStr = formatLocalDate(new Date());

  const handleNativeChange = (e: any) => {
    const val = e.target?.value;
    if (val) {
      const [year, month, day] = val.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);
      const now = new Date();
      const todayEnd = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999
      );
      if (newDate.getTime() > todayEnd.getTime()) {
        return;
      }
      onChange(newDate);
    }
  };

  const handleClick = (e: any) => {
    try {
      if (typeof e.target?.showPicker === 'function') {
        e.target.showPicker();
      }
    } catch {}
  };

  return (
    <View style={styles.datePill} testID={testID}>
      <Calendar
        color={COLORS.light.iconMuted}
        size={18}
        style={styles.pillIcon}
      />
      <Text style={styles.datePillText}>{formattedDate}</Text>
      {React.createElement('input', {
        ref: inputRef,
        type: 'date',
        id: `${testID}-native-input`,
        name: `${testID}-date`,
        max: todayStr,
        value: dateValueStr,
        onChange: handleNativeChange,
        onClick: handleClick,
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
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  datePill: {
    position: 'relative',
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
