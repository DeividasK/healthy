import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { X } from 'lucide-react-native';

export interface FormFieldProps {
  label: string;
  nativeID?: string;
  error?: string | null;
  required?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Custom control, or content rendered below `inputProps` (e.g. suggestions). */
  children?: React.ReactNode;
  /** Renders the standard text input. Multiline inputs get text-area sizing. */
  inputProps?: TextInputProps;
  onRemove?: () => void;
  removeTestID?: string;
  /** Accessible name of the remove button; defaults to "Remove <label>". */
  removeLabel?: string;
  testID?: string;
}

/** The standard bordered text input used by every form field. */
export function FormTextInput({ style, multiline, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={COLORS.light.placeholder}
      multiline={multiline}
      {...props}
      style={[styles.input, multiline && styles.textArea, style]}
    />
  );
}

/**
 * Labelled form field shell shared by all forms: label row with an optional
 * remove button, then either a standard text input or a custom control.
 */
export function FormField({
  label,
  nativeID,
  error,
  required,
  style,
  children,
  inputProps,
  onRemove,
  removeTestID,
  removeLabel,
  testID,
}: FormFieldProps) {
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={styles.header}>
        <Text
          nativeID={nativeID ? `${nativeID}-label` : undefined}
          style={styles.label}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {onRemove && (
          <TouchableOpacity
            onPress={onRemove}
            testID={removeTestID}
            accessibilityRole="button"
            accessibilityLabel={removeLabel || `Remove ${label.toLowerCase()}`}
            hitSlop={10}
            activeOpacity={0.7}
          >
            <X size={16} color={COLORS.light.iconClear} />
          </TouchableOpacity>
        )}
      </View>
      {inputProps && <FormTextInput {...inputProps} />}
      {children}
      {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  required: {
    color: COLORS.light.destructive,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.light.border,
    borderRadius: 10,
    backgroundColor: COLORS.light.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.light.foreground,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: COLORS.light.destructive,
    marginTop: 4,
  },
});
