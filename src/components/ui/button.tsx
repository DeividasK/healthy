import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  type PressableProps,
  View,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-lg font-medium transition-opacity active:opacity-85',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-sm',
        secondary:
          'bg-card border border-border text-foreground shadow-sm active:bg-muted',
        outline:
          'border border-primary bg-transparent text-primary active:bg-primary/10',
        destructive:
          'bg-destructive text-destructive-foreground active:opacity-90',
        ghost: 'bg-transparent text-foreground active:bg-muted',
        link: 'bg-transparent text-primary underline',
      },
      size: {
        default: 'h-11 px-4 py-2.5',
        sm: 'h-9 px-3 py-1.5 rounded-md',
        lg: 'h-12 px-6 py-3 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-semibold text-center select-none', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      outline: 'text-primary',
      destructive: 'text-destructive-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
    size: {
      default: 'text-sm',
      sm: 'text-xs',
      lg: 'text-base',
      icon: 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'default',
  },
});

export interface ButtonProps
  extends
    Omit<PressableProps, 'children'>,
    VariantProps<typeof buttonVariants> {
  children?: React.ReactNode;
  title?: string;
  loading?: boolean;
  className?: string;
  textClassName?: string;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<View, ButtonProps>(
  (
    {
      children,
      title,
      variant,
      size,
      loading = false,
      disabled,
      className,
      textClassName,
      icon,
      ...props
    },
    ref
  ) => {
    const content = title ?? children;

    return (
      <Pressable
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          buttonVariants({ variant, size }),
          (disabled || loading) && 'opacity-50 pointer-events-none',
          className
        )}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              variant === 'primary' || variant === 'destructive'
                ? '#FFFFFF'
                : '#5A826D'
            }
          />
        ) : (
          <>
            {icon}
            {typeof content === 'string' ? (
              <Text
                className={cn(
                  buttonTextVariants({ variant, size }),
                  textClassName
                )}
              >
                {content}
              </Text>
            ) : (
              content
            )}
          </>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';
