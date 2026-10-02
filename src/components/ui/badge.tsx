import React from 'react';
import { View, Text, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex flex-row items-center justify-center rounded-full border px-2 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 border-primary/20 text-primary',
        normal:
          'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400',
        low: 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400',
        high: 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400',
        caution:
          'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-400',
        outline: 'border-border text-foreground bg-transparent',
        secondary: 'bg-muted border-transparent text-muted-foreground',
      },
      size: {
        sm: 'px-1.5 py-0.5 text-[10px]',
        default: 'px-2 py-0.5 text-[11px]',
        lg: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const badgeTextVariants = cva('font-bold tracking-wide select-none', {
  variants: {
    variant: {
      default: 'text-primary',
      normal: 'text-emerald-600 dark:text-emerald-400',
      low: 'text-blue-600 dark:text-blue-400',
      high: 'text-rose-600 dark:text-rose-400',
      caution: 'text-amber-600 dark:text-amber-400',
      outline: 'text-foreground',
      secondary: 'text-muted-foreground',
    },
    size: {
      sm: 'text-[10px]',
      default: 'text-[11px]',
      lg: 'text-xs',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

export interface BadgeProps
  extends ViewProps, VariantProps<typeof badgeVariants> {
  label?: string;
  icon?: React.ReactNode;
  textClassName?: string;
}

export const Badge = React.forwardRef<View, BadgeProps>(
  (
    {
      children,
      label,
      variant,
      size,
      className,
      textClassName,
      icon,
      ...props
    },
    ref
  ) => {
    const content = label ?? children;

    return (
      <View
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      >
        {icon && <View className="mr-1">{icon}</View>}
        {typeof content === 'string' ? (
          <Text
            className={cn(badgeTextVariants({ variant, size }), textClassName)}
          >
            {content}
          </Text>
        ) : (
          content
        )}
      </View>
    );
  }
);

Badge.displayName = 'Badge';
