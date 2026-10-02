import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/cn';

export interface TelemetryCardProps extends ViewProps {
  name: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  interpretation?: 'normal' | 'low' | 'high' | 'caution';
  className?: string;
}

export const TelemetryCard = React.forwardRef<View, TelemetryCardProps>(
  (
    { name, value, unit, referenceRange, interpretation, className, ...props },
    ref
  ) => {
    return (
      <Card ref={ref} className={cn('p-3.5', className)} {...props}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-sm font-semibold text-foreground">
              {name}
            </Text>
            {referenceRange && (
              <Text className="text-xs text-muted-foreground mt-0.5">
                Ref: {referenceRange}
              </Text>
            )}
          </View>
          <View className="items-end gap-1">
            <View className="flex-row items-baseline gap-1">
              <Text className="font-mono text-base font-bold text-foreground">
                {value}
              </Text>
              {unit && (
                <Text className="font-mono text-xs font-medium text-muted-foreground">
                  {unit}
                </Text>
              )}
            </View>
            {interpretation && (
              <Badge
                variant={interpretation}
                label={
                  interpretation === 'normal'
                    ? 'Normal'
                    : interpretation === 'low'
                      ? 'Low'
                      : interpretation === 'high'
                        ? 'High'
                        : 'Caution'
                }
              />
            )}
          </View>
        </View>
      </Card>
    );
  }
);

TelemetryCard.displayName = 'TelemetryCard';
