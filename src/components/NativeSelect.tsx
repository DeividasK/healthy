import React from 'react';
import { ChevronDown } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import type { NativeSelectProps } from './NativeSelect.types';

export function NativeSelect({
  compact = false,
  value,
  options,
  onChange,
  label,
  testID,
  name,
}: NativeSelectProps) {
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <select
        id={testID}
        name={name}
        data-testid={testID}
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          height: compact ? 44 : 48,
          boxSizing: 'border-box',
          appearance: 'none',
          WebkitAppearance: 'none',
          border: `1px solid ${COLORS.light.border}`,
          borderRadius: 10,
          padding: compact ? '0 28px 0 8px' : '0 44px 0 14px',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: compact ? 13 : 16,
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
          right: compact ? 8 : 14,
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
