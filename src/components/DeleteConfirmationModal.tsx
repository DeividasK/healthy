import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS } from '../theme/colors';

export interface DeleteConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  requireCountdown?: boolean;
  countdownDuration?: number;
  onConfirm: () => void;
  onCancel: () => void;
  testID?: string;
}

interface DeleteConfirmationModalContentProps {
  title: string;
  message: string;
  requireCountdown: boolean;
  countdownDuration: number;
  onConfirm: () => void;
  onCancel: () => void;
  testID: string;
}

function DeleteConfirmationModalContent({
  title,
  message,
  requireCountdown,
  countdownDuration,
  onConfirm,
  onCancel,
  testID,
}: DeleteConfirmationModalContentProps) {
  const [countdown, setCountdown] = useState(
    requireCountdown ? countdownDuration : 0
  );

  useEffect(() => {
    if (!requireCountdown) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [requireCountdown]);

  const isDeleteDisabled = countdown > 0;

  return (
    <TouchableWithoutFeedback onPress={onCancel}>
      <View style={styles.backdrop}>
        <TouchableWithoutFeedback>
          <View style={styles.card} testID={`${testID}-card`}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID="delete-modal-cancel-button"
                style={styles.cancelButton}
                onPress={onCancel}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                testID="delete-modal-confirm-button"
                style={[
                  styles.deleteButton,
                  isDeleteDisabled && styles.deleteButtonDisabled,
                ]}
                disabled={isDeleteDisabled}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>
                  {countdown > 0 ? `Delete (${countdown}s)` : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </TouchableWithoutFeedback>
  );
}

export function DeleteConfirmationModal({
  visible,
  title,
  message,
  requireCountdown = false,
  countdownDuration = 5,
  onConfirm,
  onCancel,
  testID = 'delete-confirmation-modal',
}: DeleteConfirmationModalProps) {
  if (!visible) return null;

  return (
    <Modal
      testID={testID}
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <DeleteConfirmationModalContent
        title={title}
        message={message}
        requireCountdown={requireCountdown}
        countdownDuration={countdownDuration}
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID={testID}
      />
    </Modal>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.light.foreground,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    color: COLORS.light.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.pillBorder,
    backgroundColor: COLORS.light.pillBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
  deleteButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
    backgroundColor: COLORS.light.destructive,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  deleteButtonDisabled: {
    opacity: 0.45,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.light.destructiveForeground,
  },
});
