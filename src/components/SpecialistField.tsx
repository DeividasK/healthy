import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { FormField } from './FormField';
import { useDismissOnBlur } from './useDismissOnBlur';

interface SpecialistFieldProps {
  label?: string;
  /** Form field name; defaults to `specialistName`. */
  name?: string;
  /** Used as the input's id, nativeID and testID. */
  inputID: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Known specialists offered as suggestions; any other name may be typed. */
  suggestions: string[];
  required?: boolean;
  placeholder?: string;
  onRemove?: () => void;
  removeTestID?: string;
  autocompleteTestID?: string;
}

/**
 * Free-text name with autocomplete from known names: specialists, and
 * service providers via `label`, `name` and `placeholder`.
 */
export function SpecialistField({
  label = 'Specialist',
  name = 'specialistName',
  inputID,
  value,
  onChangeText,
  suggestions,
  required,
  placeholder = 'e.g. Dr. Sarah Adams',
  onRemove,
  removeTestID,
  autocompleteTestID = `${inputID}-autocomplete`,
}: SpecialistFieldProps) {
  const suggestionsState = useDismissOnBlur();
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query
      ? suggestions.filter((name) => name.toLowerCase().includes(query))
      : suggestions;
  }, [value, suggestions]);
  const isOpen = suggestionsState.isOpen && matches.length > 0;

  const { open, close, onBlur: handleBlur, containerRef } = suggestionsState;

  return (
    <View
      ref={containerRef}
      onBlur={handleBlur}
      style={isOpen && { zIndex: 10 }}
    >
      <FormField
        label={label}
        nativeID={inputID}
        required={required}
        onRemove={onRemove}
        removeTestID={removeTestID}
        removeLabel={`Remove ${label.toLowerCase()}`}
        inputProps={{
          testID: inputID,
          id: inputID,
          nativeID: inputID,
          name,
          accessibilityLabel: label,
          placeholder,
          value,
          onChangeText: (text) => {
            onChangeText(text);
            open();
          },
          onFocus: open,
          onBlur: handleBlur,
        }}
      >
        {isOpen && (
          <AutocompleteDropdown
            testID={`${autocompleteTestID}-list`}
            itemTestIDPrefix={`${autocompleteTestID}-item-`}
            items={matches.map((name, index) => ({
              id: String(index),
              label: name,
            }))}
            onSelect={(item) => {
              onChangeText(item.label);
              close();
            }}
          />
        )}
      </FormField>
    </View>
  );
}
