import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { formatLocalDate } from '@/src/utils/dateUtils';
import { COLORS } from '@/src/theme/colors';

export interface NativeDatePickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  testID?: string;
  variant?: 'pill' | 'input';
  id?: string;
  name?: string;
  allowFuture?: boolean;
}

export function NativeDatePicker({
  value,
  onChange,
  placeholder = 'Not specified',
  testID = 'date-picker-button',
  variant = 'pill',
  id,
  name,
  allowFuture = false,
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
    if (!val) {
      onChange(null);
      return;
    }
    const [year, month, day] = val.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    if (!allowFuture) {
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
    }
    onChange(newDate);
  };

  const handleClick = (e: any) => {
    try {
      if (typeof e.target?.showPicker === 'function') {
        e.target.showPicker();
      }
    } catch {}
  };

  const isInput = variant === 'input';

  return (
    <View
      style={isInput ? styles.dateInputContainer : styles.datePill}
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
      {React.createElement('input', {
        ref: inputRef,
        type: 'date',
        id: id || `${testID}-native-input`,
        name: name || `${testID}-date`,
        'aria-label': name || 'Date',
        max: allowFuture ? undefined : todayStr,
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
  dateInputContainer: {
    position: 'relative',
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
  pillIcon: {
    marginRight: 8,
  },
  datePillText: {
    color: COLORS.light.foreground,
    fontSize: 14,
    fontWeight: '600',
  },
  dateInputText: {
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  placeholderText: {
    color: COLORS.light.placeholder,
  },
});
