import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      default: 'text-base font-normal',
      display: 'text-4xl font-bold tracking-tight',
      headline: 'text-2xl font-bold tracking-tight',
      title: 'text-lg font-semibold',
      subtitle: 'text-sm font-medium text-muted-foreground',
      body: 'text-sm font-normal leading-relaxed',
      caption: 'text-xs text-muted-foreground',
      metric: 'font-mono text-xl font-bold tracking-tight',
      'metric-sm': 'font-mono text-sm font-medium',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface TextProps
  extends RNTextProps, VariantProps<typeof textVariants> {
  className?: string;
}

export const Text = React.forwardRef<RNText, TextProps>(
  ({ className, variant, style, ...props }, ref) => {
    return (
      <RNText
        ref={ref}
        style={style}
        className={cn(textVariants({ variant }), className)}
        {...props}
      />
    );
  }
);

Text.displayName = 'Text';
