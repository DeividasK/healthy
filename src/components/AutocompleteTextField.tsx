import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { FormField } from './FormField';
import { useDismissOnBlur } from './useDismissOnBlur';

interface AutocompleteTextFieldProps {
  label: string;
  /** Form field name. */
  name: string;
  /** Used as the input's id, nativeID and testID. */
  inputID: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Values offered as suggestions; any other text may be typed. */
  suggestions: string[];
  required?: boolean;
  placeholder?: string;
  /** Accessible name of the input; defaults to `label`. */
  accessibilityLabel?: string;
  onRemove?: () => void;
  removeTestID?: string;
  /** Accessible name of the remove button; defaults to "Remove <label>". */
  removeLabel?: string;
  /** Prefix of the suggestion list (`-list`) and item (`-item-N`) test IDs. */
  autocompleteTestID?: string;
}

/**
 * Free-text form field that suggests matching known values (specialists,
 * service providers, service types). Any other text may be typed.
 */
export function AutocompleteTextField({
  label,
  name,
  inputID,
  value,
  onChangeText,
  suggestions,
  required,
  placeholder,
  accessibilityLabel = label,
  onRemove,
  removeTestID,
  removeLabel = `Remove ${label.toLowerCase()}`,
  autocompleteTestID = `${inputID}-autocomplete`,
}: AutocompleteTextFieldProps) {
  const suggestionsState = useDismissOnBlur();
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query
      ? suggestions.filter((item) => item.toLowerCase().includes(query))
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
        removeLabel={removeLabel}
        inputProps={{
          testID: inputID,
          id: inputID,
          nativeID: inputID,
          name,
          accessibilityLabel,
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
            items={matches.map((item, index) => ({
              id: String(index),
              label: item,
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
