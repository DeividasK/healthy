import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { Copy, X } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { PlusCircleButton } from './PlusCircleButton';

/**
 * Heading of a group inside a form field (a regimen phase or dose, a
 * consultation diagnosis): its `+` opens the group's options, an optional
 * duplicate button beside it copies the group, and the `x` removes it.
 */
export function GroupHeader({
  title,
  titleStyle,
  idPrefix,
  onAdd,
  onDuplicate,
  onRemove,
}: {
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  idPrefix: string;
  /** Omitted when the group has nothing left to add. */
  onAdd?: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
      {onAdd && (
        <PlusCircleButton
          size={28}
          iconSize={16}
          onPress={onAdd}
          testID={`${idPrefix}-add`}
          accessibilityRole="button"
          accessibilityLabel={`Add to ${title.toLowerCase()}`}
        />
      )}
      {onDuplicate && (
        <PlusCircleButton
          size={28}
          onPress={onDuplicate}
          testID={`${idPrefix}-duplicate`}
          accessibilityRole="button"
          accessibilityLabel={`Duplicate ${title.toLowerCase()}`}
        >
          <Copy color={COLORS.light.iconMuted} size={14} />
        </PlusCircleButton>
      )}
      {onRemove && (
        <TouchableOpacity
          onPress={onRemove}
          testID={`${idPrefix}-remove`}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title.toLowerCase()}`}
          hitSlop={10}
          activeOpacity={0.7}
          style={styles.remove}
        >
          <X size={16} color={COLORS.light.iconClear} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  remove: {
    marginLeft: 'auto',
  },
});
