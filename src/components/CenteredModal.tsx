import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { useDismissKey } from '@/src/utils/dismissKey';

/**
 * A dialog card centred over a dimmed backdrop. Tapping the backdrop, Escape
 * (web) or back (Android) closes it. Without `onClose` it cannot be
 * dismissed: only its own buttons close it.
 */
const ignoreDismiss = () => {};

export function CenteredModal({
  visible,
  title,
  icon: Icon,
  onClose,
  testID,
  children,
}: {
  visible: boolean;
  title: string;
  icon?: LucideIcon;
  onClose?: () => void;
  testID: string;
  children?: React.ReactNode;
}) {
  // Still registered without `onClose`, so Escape or back cannot reach
  // whatever is underneath.
  useDismissKey(onClose ?? ignoreDismiss, visible);
  if (!visible) return null;

  return (
    <Modal
      testID={testID}
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose ?? ignoreDismiss}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={styles.card}
          testID={`${testID}-card`}
          onPress={(e) => e.stopPropagation?.()}
        >
          <View style={styles.titleRow}>
            {Icon && <Icon size={18} color={COLORS.light.primary} />}
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * The buttons at the bottom of a `CenteredModal`, aligned to the end, or
 * `stacked` full width for choices with longer labels.
 */
export function ModalActions({
  children,
  stacked,
}: {
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <View style={stacked ? styles.actionsColumn : styles.actionsRow}>
      {children}
    </View>
  );
}

/** A pill button in `ModalActions`. */
export function ModalButton({
  label,
  onPress,
  tone = 'secondary',
  disabled,
  testID,
  ref,
}: {
  label: string;
  onPress: () => void;
  tone?: 'secondary' | 'primary' | 'destructive';
  disabled?: boolean;
  testID?: string;
  ref?: React.Ref<View>;
}) {
  return (
    <TouchableOpacity
      ref={ref}
      testID={testID}
      accessibilityRole="button"
      style={[
        styles.button,
        tone === 'secondary' ? styles.secondaryButton : styles.solidButton,
        tone === 'primary' && styles.primaryButton,
        disabled && styles.disabledButton,
      ]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={tone === 'secondary' ? 0.7 : 0.8}
    >
      <Text
        style={[
          styles.buttonText,
          tone === 'secondary' && styles.secondaryButtonText,
          tone === 'primary' && styles.primaryButtonText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.light.modalBackdrop,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.light.card,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.light.cardBorder,
    ...Platform.select({
      web: {
        boxShadow: COLORS.light.shadowWebModalCard,
      },
      default: {
        shadowColor: COLORS.light.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      },
    }),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionsColumn: {
    alignItems: 'stretch',
    gap: 10,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.pillBackground,
  },
  solidButton: {
    backgroundColor: COLORS.light.destructive,
    minWidth: 100,
  },
  primaryButton: {
    backgroundColor: COLORS.light.primary,
  },
  disabledButton: {
    opacity: 0.45,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.destructiveForeground,
  },
  secondaryButtonText: {
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  primaryButtonText: {
    color: COLORS.light.primaryForeground,
  },
});
