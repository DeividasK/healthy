import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';

export interface AddOptionItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  testID?: string;
}

export interface AddOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  options: AddOptionItem[];
  overlayTestID?: string;
  cardTestID?: string;
}

export function AddOptionsModal({
  visible,
  onClose,
  options,
  overlayTestID = 'plus-menu-overlay',
  cardTestID = 'plus-menu-card',
}: AddOptionsModalProps) {
  if (!visible || options.length === 0) {
    return null;
  }

  return (
    <View style={styles.modalOverlay}>
      <TouchableOpacity
        testID={overlayTestID}
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />
      <View testID={cardTestID} style={styles.plusMenuCard}>
        {options.map((option, index) => (
          <React.Fragment key={option.id}>
            {index > 0 && <View style={styles.plusMenuDivider} />}
            <TouchableOpacity
              testID={option.testID}
              style={styles.plusMenuItem}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              activeOpacity={0.7}
            >
              {option.icon}
              <Text style={styles.plusMenuItemText}>{option.label}</Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.light.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 1000,
  },
  plusMenuCard: {
    width: 220,
    backgroundColor: COLORS.light.card,
    borderRadius: 12,
    padding: 8,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebModalCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 5,
      },
    }),
  },
  plusMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  plusMenuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  plusMenuDivider: {
    height: 1,
    backgroundColor: COLORS.light.dropdownSeparator,
  },
});
