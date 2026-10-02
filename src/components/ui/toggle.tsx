import React from 'react';
import { Switch, type SwitchProps } from 'react-native';
import { useColorScheme } from '../../lib/useColorScheme';

export interface ToggleProps extends SwitchProps {
  className?: string;
}

export const Toggle = React.forwardRef<Switch, ToggleProps>(
  ({ value, onValueChange, disabled, className, ...props }, ref) => {
    const { colors } = useColorScheme();

    return (
      <Switch
        ref={ref}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border,
          true: colors.primary,
        }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.border}
        {...props}
      />
    );
  }
);

Toggle.displayName = 'Toggle';
