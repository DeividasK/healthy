import React from 'react';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { NativeSelectProps } from './NativeSelect.types';

export function NativeSelect({
  value,
  options,
  onChange,
  label,
  testID,
  name,
  disabled,
}: NativeSelectProps) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        id={testID}
        name={name}
        disabled={disabled}
        data-testid={testID}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          height: 48,
          boxSizing: 'border-box',
          appearance: 'none',
          WebkitAppearance: 'none',
          border: `1px solid ${COLORS.light.border}`,
          borderRadius: 10,
          padding: '0 44px 0 14px',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 16,
          color: COLORS.light.foreground,
          backgroundColor: COLORS.light.card,
        }}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        data-testid={`${testID}-caret`}
        style={{
          position: 'absolute',
          right: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <ChevronDown size={18} color={COLORS.light.iconMuted} />
      </span>
    </div>
  );
}
