import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';

export interface BiomarkerRangeBarProps extends ViewProps {
  min: number;
  max: number;
  value: number;
  lowThreshold?: number;
  highThreshold?: number;
  unit?: string;
  className?: string;
}

export const BiomarkerRangeBar = React.forwardRef<View, BiomarkerRangeBarProps>(
  (
    { min, max, value, lowThreshold, highThreshold, unit, className, ...props },
    ref
  ) => {
    const range = Math.max(max - min, 1);
    const clampedValue = Math.min(Math.max(value, min), max);
    const percentage = Math.round(((clampedValue - min) / range) * 100);

    return (
      <View
        ref={ref}
        className={cn('w-full flex-col gap-1', className)}
        {...props}
      >
        <View className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <View
            className="h-full rounded-full bg-primary"
            style={{ width: `${percentage}%` }}
          />
        </View>
        <View className="flex-row justify-between text-xs text-muted-foreground">
          <Text className="font-mono text-[10px] text-muted-foreground">
            {min} {unit}
          </Text>
          <Text className="font-mono text-[10px] font-semibold text-foreground">
            {value} {unit}
          </Text>
          <Text className="font-mono text-[10px] text-muted-foreground">
            {max} {unit}
          </Text>
        </View>
      </View>
    );
  }
);

BiomarkerRangeBar.displayName = 'BiomarkerRangeBar';
