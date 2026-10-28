import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '@/src/theme/colors';
import { useFieldRevealContext } from './FieldReveal';

/** The card's top margin and borders, on top of its list height. */
const CARD_CHROME = 8;

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

export function AutocompleteDropdown(props: AutocompleteDropdownProps) {
  if (props.items.length === 0) {
    return null;
  }
  return <DropdownCard {...props} />;
}

function DropdownCard({
  items,
  onSelect,
  focusedId,
  onFocusItem,
  testID = 'autocomplete-list',
  itemTestIDPrefix = 'autocomplete-item-',
  maxHeight = 180,
}: AutocompleteDropdownProps) {
  const cardRef = useRef<View>(null);
  const reveal = useFieldRevealContext();

  // Opening near the bottom of a form scrolls the whole list above the
  // action dock, which would otherwise cover its lower options.
  useEffect(() => {
    if (!reveal || !cardRef.current) return;
    reveal.revealDropdown(cardRef.current, maxHeight + CARD_CHROME);
    return () => reveal.closeDropdown();
  }, [reveal, maxHeight]);

  return (
    <View ref={cardRef} style={[styles.card, { maxHeight }]} testID={testID}>
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
  // Overlays the fields below; the parent needs a raised zIndex while open.
  card: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    zIndex: 10,
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
