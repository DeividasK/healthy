import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pencil, Trash2 } from 'lucide-react-native';
import { PlusCircleButton } from './PlusCircleButton';
import { COLORS } from '@/src/theme/colors';

interface ResourceActionDockProps {
  deleteLabel: string;
  editLabel: string;
  onDelete: () => void;
  onEdit: () => void;
  onAdd?: () => void;
  addLabel?: string;
  deleteTestID: string;
  editTestID: string;
  addTestID?: string;
}

export function ResourceActionDock({
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
  onAdd,
  addLabel,
  deleteTestID,
  editTestID,
  addTestID,
}: ResourceActionDockProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.positioner, { bottom: Math.max(insets.bottom, 12) + 16 }]}
    >
      <View
        style={styles.dock}
        accessibilityRole="toolbar"
        accessibilityLabel="Resource actions"
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          testID={deleteTestID}
          style={styles.actionButton}
          onPress={onDelete}
          activeOpacity={0.7}
        >
          <Trash2 color={COLORS.light.iconMuted} size={20} />
        </TouchableOpacity>

        {onAdd && addLabel && addTestID && (
          <PlusCircleButton
            accessibilityRole="button"
            accessibilityLabel={addLabel}
            testID={addTestID}
            variant="primary"
            size={52}
            iconSize={25}
            onPress={onAdd}
            activeOpacity={0.8}
          />
        )}

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={editLabel}
          testID={editTestID}
          style={styles.actionButton}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <Pencil color={COLORS.light.iconMuted} size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    pointerEvents: 'box-none',
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    borderRadius: 999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
