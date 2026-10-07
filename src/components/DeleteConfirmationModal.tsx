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
import { Check } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

export interface DeleteConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  requireCountdown?: boolean;
  countdownDuration?: number;
  showCloudDeleteOption?: boolean;
  cloudDeleteLabel?: string;
  onConfirm: (options?: { deleteFromCloud?: boolean }) => void | Promise<void>;
  onCancel: () => void;
  testID?: string;
}

interface DeleteConfirmationModalContentProps {
  title: string;
  message: string;
  confirmLabel?: string;
  requireCountdown: boolean;
  countdownDuration: number;
  showCloudDeleteOption?: boolean;
  cloudDeleteLabel?: string;
  onConfirm: (options?: { deleteFromCloud?: boolean }) => void | Promise<void>;
  onCancel: () => void;
  testID: string;
}

function DeleteConfirmationModalContent({
  title,
  message,
  confirmLabel = 'Delete',
  requireCountdown,
  countdownDuration,
  showCloudDeleteOption = false,
  cloudDeleteLabel = 'Delete from Google Drive',
  onConfirm,
  onCancel,
  testID,
}: DeleteConfirmationModalContentProps) {
  const [countdown, setCountdown] = useState(
    requireCountdown ? countdownDuration : 0
  );
  const [deleteFromCloud, setDeleteFromCloud] = useState(false);

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

            {showCloudDeleteOption && (
              <TouchableOpacity
                testID="delete-from-cloud-checkbox"
                style={styles.checkboxRow}
                onPress={() => setDeleteFromCloud((prev) => !prev)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: deleteFromCloud }}
              >
                <View
                  style={[
                    styles.checkbox,
                    deleteFromCloud && styles.checkboxChecked,
                  ]}
                >
                  {deleteFromCloud && (
                    <Check size={14} color="#FFFFFF" strokeWidth={3} />
                  )}
                </View>
                <Text style={styles.checkboxLabel}>{cloudDeleteLabel}</Text>
              </TouchableOpacity>
            )}

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
                onPress={() => onConfirm({ deleteFromCloud })}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteButtonText}>
                  {countdown > 0
                    ? `${confirmLabel} (${countdown}s)`
                    : confirmLabel}
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
  confirmLabel = 'Delete',
  requireCountdown = true,
  countdownDuration = 5,
  showCloudDeleteOption = false,
  cloudDeleteLabel = 'Delete from Google Drive',
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
        confirmLabel={confirmLabel}
        requireCountdown={requireCountdown}
        countdownDuration={countdownDuration}
        showCloudDeleteOption={showCloudDeleteOption}
        cloudDeleteLabel={cloudDeleteLabel}
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
    marginBottom: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: COLORS.light.foreground,
    fontWeight: '500',
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
