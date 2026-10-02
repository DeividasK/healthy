import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { Lock } from 'lucide-react-native';
import { cn } from '../../lib/cn';

export interface PrivacyBadgeProps extends ViewProps {
  label?: string;
  className?: string;
}

export const PrivacyBadge = React.forwardRef<View, PrivacyBadgeProps>(
  ({ label = '100% LOCAL-FIRST • ENCRYPTED', className, ...props }, ref) => {
    return (
      <View
        ref={ref}
        className={cn(
          'inline-flex flex-row items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1',
          className
        )}
        {...props}
      >
        <Lock size={12} color="#059669" />
        <Text className="text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
          {label}
        </Text>
      </View>
    );
  }
);

PrivacyBadge.displayName = 'PrivacyBadge';
