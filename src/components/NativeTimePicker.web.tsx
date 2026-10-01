import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, X } from 'lucide-react-native';

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
  const inputRef = useRef<any>(null);

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
    <View style={styles.timePill} testID={testID}>
      <Clock color="#414844" size={16} style={styles.pillIcon} />
      <Text style={styles.pillText}>{value}</Text>
      {React.createElement('input', {
        ref: inputRef,
        type: 'time',
        max: maxTime,
        value: value,
        onChange: handleNativeChange,
        onClick: handleClick,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 28,
          bottom: 0,
          opacity: 0,
          width: 'calc(100% - 28px)',
          height: '100%',
          cursor: 'pointer',
          zIndex: 10,
        },
      })}
      <TouchableOpacity
        testID="remove-time-button"
        onPress={onRemove}
        style={styles.removeButton}
      >
        <X color="#717973" size={14} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  timePill: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eeeeeb',
    borderWidth: 1,
    borderColor: '#c1c8c2',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillIcon: {
    marginRight: 6,
  },
  pillText: {
    color: '#1a1c1a',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 6,
  },
  removeButton: {
    zIndex: 20,
    padding: 2,
  },
});
