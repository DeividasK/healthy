import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { useColorScheme } from '../../lib/useColorScheme';

export interface ToggleProps extends SwitchProps {
  className?: string;
}

export const Toggle = React.forwardRef<Switch, ToggleProps>(
  ({ value, onValueChange, disabled, className, ...props }, ref) => {
    const { colors, isDarkColorScheme } = useColorScheme();

    return (
      <Switch
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: isDarkColorScheme ? '#334155' : '#E2E8F0',
          true: colors.primary,
        }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={isDarkColorScheme ? '#334155' : '#E2E8F0'}
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';
