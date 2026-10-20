import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import {
  AutocompleteDropdown,
  type AutocompleteItem,
} from './AutocompleteDropdown';
import { FormField, FormTextInput } from './FormField';
import { useDismissOnBlur } from './useDismissOnBlur';
import { COLORS } from '@/src/theme/colors';

interface LinkedResourcesFieldProps {
  label: string;
  /** Accessible name of the search input. */
  searchLabel: string;
  /** Every resource that can be linked, including the selected ones. */
  options: AutocompleteItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Extra control shown in a selected row, e.g. the link's role. */
  renderItemControl?: (id: string) => React.ReactNode;
  onRemove?: () => void;
  removeTestID?: string;
  testID?: string;
  /** Prefixes the search, list and row test IDs and the input id. */
  idPrefix?: string;
  /** Resource name used in test IDs, e.g. `condition`. */
  itemType?: string;
  required?: boolean;
}

/** Linked resources with remove buttons and a search box to link more. */
export function LinkedResourcesField({
  label,
  searchLabel,
  options,
  selectedIds,
  onChange,
  renderItemControl,
  onRemove,
  removeTestID,
  testID,
  idPrefix = '',
  itemType = 'condition',
  required = false,
}: LinkedResourcesFieldProps) {
  const [query, setQuery] = useState('');
  const {
    isOpen: isFocused,
    open,
    close,
    onBlur,
    containerRef: searchRef,
  } = useDismissOnBlur();
  const searchID = `${idPrefix}${itemType}-search-input`;
  // Keep an unresolved link visible rather than dropping it.
  const labelOf = (id: string) =>
    options.find((option) => option.id === id)?.label || id;
  const matches = options.filter(
    (option) =>
      !selectedIds.includes(option.id) &&
      option.label.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <FormField
      label={label}
      nativeID={searchID}
      required={required}
      style={isFocused && styles.raised}
      testID={testID}
      removeTestID={removeTestID}
      onRemove={
        onRemove &&
        (() => {
          setQuery('');
          close();
          onRemove();
        })
      }
    >
      {selectedIds.map((id, index) => (
        <View
          key={id}
          style={styles.selectedRow}
          testID={`${idPrefix}selected-${itemType}-${id}`}
        >
          <Text style={styles.selectedText}>{labelOf(id)}</Text>
          {renderItemControl?.(id)}
          <TouchableOpacity
            testID={
              index === 0
                ? `${idPrefix}remove-${itemType}-button`
                : `${idPrefix}remove-${itemType}-button-${index}`
            }
            accessibilityRole="button"
            accessibilityLabel={`Remove ${itemType} ${labelOf(id)}`}
            onPress={() => onChange(selectedIds.filter((item) => item !== id))}
          >
            <X color={COLORS.light.iconClear} size={16} />
          </TouchableOpacity>
        </View>
      ))}
      {/* Nothing is left to link once every option is selected. */}
      {options.some((option) => !selectedIds.includes(option.id)) && (
        <View ref={searchRef} onFocus={open} onBlur={onBlur}>
          <FormTextInput
            testID={searchID}
            id={searchID}
            nativeID={searchID}
            name={`${idPrefix}${itemType}Search`}
            accessibilityLabel={searchLabel}
            placeholder="Select..."
            value={query}
            onChangeText={(value) => {
              setQuery(value);
              open();
            }}
            onFocus={open}
            onBlur={onBlur}
            onPressIn={open}
          />
          {isFocused && (
            <AutocompleteDropdown
              testID={`${idPrefix}${itemType}-autocomplete-list`}
              itemTestIDPrefix={`${idPrefix}${itemType}-autocomplete-item-`}
              items={matches}
              onSelect={(item) => {
                if (!selectedIds.includes(item.id))
                  onChange([...selectedIds, item.id]);
                setQuery('');
                close();
              }}
            />
          )}
        </View>
      )}
    </FormField>
  );
}

const styles = StyleSheet.create({
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  selectedText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.light.foreground,
  },
  // Lifts the field above later siblings while its suggestions overlay them.
  raised: { zIndex: 10 },
});
