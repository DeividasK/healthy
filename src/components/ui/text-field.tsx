import React from 'react';
import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { cn } from '../../lib/cn';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  labelClassName?: string;
  inputClassName?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const TextField = React.forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      error,
      helperText,
      containerClassName,
      labelClassName,
      inputClassName,
      leadingIcon,
      trailingIcon,
      className,
      style,
      placeholderTextColor = '#717973',
      ...props
    },
    ref
  ) => {
    return (
      <View className={cn('w-full flex-col gap-1.5', containerClassName)}>
        {label && (
          <Text
            className={cn(
              'text-sm font-medium text-foreground',
              labelClassName
            )}
          >
            {label}
          </Text>
        )}
        <View
          className={cn(
            'flex-row items-center rounded-lg border border-input bg-card px-3 py-2.5 transition-colors focus-within:border-primary',
            error && 'border-destructive',
            className
          )}
        >
          {leadingIcon && <View className="mr-2">{leadingIcon}</View>}
          <TextInput
            ref={ref}
            placeholderTextColor={placeholderTextColor}
            className={cn(
              'flex-1 text-base text-foreground p-0',
              inputClassName
            )}
            style={style}
            {...props}
          />
          {trailingIcon && <View className="ml-2">{trailingIcon}</View>}
        </View>
        {error ? (
          <Text className="text-xs text-destructive">{error}</Text>
        ) : helperText ? (
          <Text className="text-xs text-muted-foreground">{helperText}</Text>
        ) : null}
      </View>
    );
  }
);

TextField.displayName = 'TextField';
