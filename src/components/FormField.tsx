import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Platform,
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
import { useFieldRevealContext } from './FieldReveal';

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
  /** Puts the label and a narrow control (e.g. a time) side by side. */
  inline?: boolean;
}

interface FieldInputRegistry {
  register(input: TextInput): void;
  unregister(input: TextInput | null): void;
}

/** Collects the first text input inside a FormField, focused on reveal. */
const FieldInputContext = createContext<FieldInputRegistry | null>(null);

/** The standard bordered text input used by every form field. */
export function FormTextInput({ style, multiline, ...props }: TextInputProps) {
  const fieldInput = useContext(FieldInputContext);
  const ownRef = useRef<TextInput | null>(null);
  return (
    <TextInput
      placeholderTextColor={COLORS.light.placeholder}
      multiline={multiline}
      {...props}
      ref={(node) => {
        if (node) {
          ownRef.current = node;
          fieldInput?.register(node);
        } else {
          fieldInput?.unregister(ownRef.current);
          ownRef.current = null;
        }
      }}
      style={[styles.input, multiline && styles.textArea, style]}
    />
  );
}

/**
 * Scrolls a field that a `+` menu just added into view and focuses its
 * control (see `useFieldReveal`). Fields present on first render are left
 * alone, since no menu choice is pending for them.
 */
function useRevealWhenAdded(
  container: React.RefObject<View | null>,
  input: React.RefObject<TextInput | null>
) {
  const reveal = useFieldRevealContext();
  useEffect(() => {
    const field = container.current;
    if (!reveal?.claim() || !field) return;
    reveal.scrollIntoView(field);
    if (Platform.OS === 'web') {
      // Covers text inputs and native selects, date and time inputs alike;
      // scrolling is left to scrollIntoView so the field clears the dock.
      (field as unknown as HTMLElement)
        .querySelector<HTMLElement>('input, textarea, select')
        ?.focus({ preventScroll: true });
    } else {
      input.current?.focus();
    }
    // Runs once, when the field mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

// React Native Web renders role="label" as a <label> element; React Native's
// types do not list that role.
const WEB_LABEL_ROLE = (
  Platform.OS === 'web' ? { role: 'label' } : {}
) as object;

/**
 * Makes the label a real `<label>` for the field's control on web, and marks
 * the control required, so assistive technology and clicks on the label work
 * as with native form fields. Fields with several controls (e.g. a regimen)
 * have no single control to name, so their label stays unbound.
 */
function useLabelForControl(
  container: React.RefObject<View | null>,
  label: React.RefObject<Text | null>,
  required?: boolean
) {
  // Runs after every render: the control can mount after the field.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const field = container.current as unknown as HTMLElement | null;
    const labelNode = label.current as unknown as HTMLLabelElement | null;
    if (!field || !labelNode) return;
    const controls = field.querySelectorAll<HTMLElement>(
      'input, select, textarea'
    );
    const control = controls.length === 1 ? controls[0] : null;
    if (control?.id) labelNode.setAttribute('for', control.id);
    else labelNode.removeAttribute('for');
    if (control && required) control.setAttribute('aria-required', 'true');
    else control?.removeAttribute('aria-required');
  });
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
  inline = false,
}: FormFieldProps) {
  const containerRef = useRef<View>(null);
  const inputRef = useRef<TextInput | null>(null);
  const labelRef = useRef<Text>(null);
  const inputRegistry = useMemo<FieldInputRegistry>(
    () => ({
      register(input) {
        inputRef.current ??= input;
      },
      unregister(input) {
        if (inputRef.current === input) inputRef.current = null;
      },
    }),
    []
  );
  useRevealWhenAdded(containerRef, inputRef);
  useLabelForControl(containerRef, labelRef, required);
  return (
    <FieldInputContext.Provider value={inputRegistry}>
      <View
        ref={containerRef}
        style={[styles.container, inline && styles.inlineContainer, style]}
        testID={testID}
      >
        <View style={[styles.header, inline && styles.inlineHeader]}>
          <Text
            ref={labelRef}
            {...WEB_LABEL_ROLE}
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
              accessibilityLabel={
                removeLabel || `Remove ${label.toLowerCase()}`
              }
              hitSlop={10}
              activeOpacity={0.7}
            >
              <X size={16} color={COLORS.light.iconClear} />
            </TouchableOpacity>
          )}
        </View>
        {inputProps && <FormTextInput {...inputProps} />}
        {inline ? (
          <View style={styles.inlineControl}>{children}</View>
        ) : (
          children
        )}
        {Boolean(error) && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </FieldInputContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    width: '100%',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inlineHeader: {
    flex: 1,
    marginBottom: 0,
  },
  inlineControl: {
    width: 140,
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
