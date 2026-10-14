import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { FormField } from './FormField';

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
  onRemove?: () => void;
  removeTestID?: string;
  autocompleteTestID?: string;
}

/** Free-text specialist name with autocomplete from known specialists. */
export function SpecialistField({
  label = 'Specialist',
  name = 'specialistName',
  inputID,
  value,
  onChangeText,
  suggestions,
  required,
  onRemove,
  removeTestID,
  autocompleteTestID = `${inputID}-autocomplete`,
}: SpecialistFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<View>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    return query
      ? suggestions.filter((name) => name.toLowerCase().includes(query))
      : suggestions;
  }, [value, suggestions]);
  const isOpen = isFocused && matches.length > 0;

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );
  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsFocused(true);
  };
  const handleBlur = (event: any) => {
    // Focus moving onto a suggestion keeps the list open for its press.
    const next = event?.nativeEvent?.relatedTarget ?? event?.relatedTarget;
    if (next && (containerRef.current as any)?.contains?.(next)) return;
    // Delay so a tap on a suggestion lands before the list unmounts.
    closeTimer.current = setTimeout(() => setIsFocused(false), 150);
  };

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
          placeholder: 'e.g. Dr. Sarah Adams',
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
              setIsFocused(false);
            }}
          />
        )}
      </FormField>
    </View>
  );
}
