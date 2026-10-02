import React from 'react';
import { View, type ViewProps, Text, type TextProps } from 'react-native';
import { cn } from '../../lib/cn';

export interface CardProps extends ViewProps {
  className?: string;
}

export const Card = React.forwardRef<View, CardProps>(
  ({ className, style, ...props }, ref) => (
    <View
      ref={ref}
      style={style}
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn('flex-col space-y-1.5 pb-3', className)}
      {...props}
    />
  )
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<Text, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn(
        'text-lg font-semibold tracking-tight text-foreground',
        className
      )}
      {...props}
    />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<Text, TextProps>(
  ({ className, ...props }, ref) => (
    <Text
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
);
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View ref={ref} className={cn('pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<View, ViewProps>(
  ({ className, ...props }, ref) => (
    <View
      ref={ref}
      className={cn(
        'flex-row items-center pt-3 border-t border-border/50',
        className
      )}
      {...props}
    />
  )
);
CardFooter.displayName = 'CardFooter';
