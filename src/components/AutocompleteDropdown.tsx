import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '@/src/theme/colors';

export interface AutocompleteItem {
  id: string;
  label: string;
}

export interface AutocompleteDropdownProps {
  items: AutocompleteItem[];
  onSelect: (item: AutocompleteItem) => void;
  focusedId?: string | null;
  onFocusItem?: (id: string) => void;
  testID?: string;
  itemTestIDPrefix?: string;
  maxHeight?: number;
}

export function AutocompleteDropdown({
  items,
  onSelect,
  focusedId,
  onFocusItem,
  testID = 'autocomplete-list',
  itemTestIDPrefix = 'autocomplete-item-',
  maxHeight = 180,
}: AutocompleteDropdownProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={[styles.card, { maxHeight }]} testID={testID}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={[styles.scroll, { maxHeight }]}
      >
        {items.map((item) => {
          const isFocused = focusedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              testID={`${itemTestIDPrefix}${item.id}`}
              style={[styles.item, isFocused && styles.itemFocused]}
              onFocus={() => onFocusItem?.(item.id)}
              onPress={() => onSelect(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.itemText, isFocused && styles.itemTextFocused]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    backgroundColor: COLORS.light.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebDropdown,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      },
    }),
  },
  scroll: {
    // maxHeight applied dynamically
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.light.dropdownSeparator,
  },
  itemFocused: {
    backgroundColor: COLORS.light.dropdownHighlight,
  },
  itemText: {
    fontSize: 14,
    color: COLORS.light.foreground,
  },
  itemTextFocused: {
    color: COLORS.light.primary,
    fontWeight: '600',
  },
});
