import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';

export interface NativeTimePickerProps {
  value: string; // "HH:mm"
  onChange: (time: string) => void;
  maxTime?: string;
  testID?: string;
  id?: string;
  name?: string;
}

/** Bordered time field; the browser's time input sits invisibly on top. */
export function NativeTimePicker({
  value,
  onChange,
  maxTime,
  testID = 'time-picker-button',
  id,
  name,
}: NativeTimePickerProps) {
  const handleNativeChange = (e: any) => {
    const val = e.target?.value;
    if (val) {
      if (maxTime && val > maxTime) {
        return;
      }
      onChange(val);
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
    <View style={styles.timeInputContainer} testID={testID}>
      <Clock color={COLORS.light.iconMuted} size={18} style={styles.icon} />
      <Text style={styles.timeText}>{value}</Text>
      {React.createElement('input', {
        type: 'time',
        id: id || `${testID}-native-input`,
        name: name || `${testID}-time`,
        'aria-label': 'Time',
        max: maxTime,
        value: value,
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
  timeInputContainer: {
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
  icon: {
    marginRight: 8,
  },
  timeText: {
    fontSize: 16,
    color: COLORS.light.foreground,
  },
});
