import React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '../../lib/cn';

export interface SeparatorProps extends ViewProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const Separator = React.forwardRef<View, SeparatorProps>(
  ({ orientation = 'horizontal', className, style, ...props }, ref) => {
    return (
      <View
        ref={ref}
        style={style}
        className={cn(
          'bg-border shrink-0',
          orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
          className
        )}
        {...props}
      />
    );
  }
);

Separator.displayName = 'Separator';
