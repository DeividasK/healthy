import React, { useState, useEffect, useRef } from 'react';
import { focusWhenReady } from '@/src/utils/focus';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { Check } from 'lucide-react-native';
import { COLORS } from '@/src/theme/colors';
import { CenteredModal, ModalActions, ModalButton } from './CenteredModal';

export interface DeleteConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Focus the cancel button on open (web), so Enter keeps the data. */
  focusCancel?: boolean;
  requireCountdown?: boolean;
  countdownDuration?: number;
  showCloudDeleteOption?: boolean;
  cloudDeleteLabel?: string;
  onConfirm: (options?: { deleteFromCloud?: boolean }) => void | Promise<void>;
  onCancel: () => void;
  testID?: string;
  /** Fields shown below the message, e.g. a date for a confirmed change. */
  children?: React.ReactNode;
  /** `primary` for confirmations that change rather than delete data. */
  confirmTone?: 'destructive' | 'primary';
}

interface DeleteConfirmationModalContentProps {
  message: string;
  confirmLabel?: string;
  cancelLabel: string;
  focusCancel: boolean;
  requireCountdown: boolean;
  countdownDuration: number;
  showCloudDeleteOption?: boolean;
  cloudDeleteLabel?: string;
  onConfirm: (options?: { deleteFromCloud?: boolean }) => void | Promise<void>;
  onCancel: () => void;
  children?: React.ReactNode;
  confirmTone: 'destructive' | 'primary';
}

function DeleteConfirmationModalContent({
  message,
  confirmLabel = 'Delete',
  cancelLabel,
  focusCancel,
  requireCountdown,
  countdownDuration,
  showCloudDeleteOption = false,
  cloudDeleteLabel = 'Delete from Google Drive',
  onConfirm,
  onCancel,
  children,
  confirmTone,
}: DeleteConfirmationModalContentProps) {
  const [countdown, setCountdown] = useState(
    requireCountdown ? countdownDuration : 0
  );
  const [deleteFromCloud, setDeleteFromCloud] = useState(false);
  const cancelRef = useRef<View>(null);

  useEffect(() => {
    if (focusCancel && Platform.OS === 'web')
      focusWhenReady(cancelRef.current as unknown as HTMLElement);
  }, [focusCancel]);

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
    <>
      {Boolean(message) && <Text style={styles.message}>{message}</Text>}
      {children}

      {showCloudDeleteOption && (
        <TouchableOpacity
          testID="delete-from-cloud-checkbox"
          style={styles.checkboxRow}
          onPress={() => setDeleteFromCloud((prev) => !prev)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: deleteFromCloud }}
          aria-checked={deleteFromCloud}
        >
          <View
            style={[styles.checkbox, deleteFromCloud && styles.checkboxChecked]}
          >
            {deleteFromCloud && (
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            )}
          </View>
          <Text style={styles.checkboxLabel}>{cloudDeleteLabel}</Text>
        </TouchableOpacity>
      )}

      <ModalActions>
        <ModalButton
          ref={cancelRef}
          testID="delete-modal-cancel-button"
          label={cancelLabel}
          onPress={onCancel}
        />
        <ModalButton
          testID="delete-modal-confirm-button"
          tone={confirmTone}
          label={
            countdown > 0 ? `${confirmLabel} (${countdown}s)` : confirmLabel
          }
          disabled={isDeleteDisabled}
          onPress={() => onConfirm({ deleteFromCloud })}
        />
      </ModalActions>
    </>
  );
}

export function DeleteConfirmationModal({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  focusCancel = false,
  requireCountdown = true,
  countdownDuration = 5,
  showCloudDeleteOption = false,
  cloudDeleteLabel = 'Delete from Google Drive',
  onConfirm,
  onCancel,
  testID = 'delete-confirmation-modal',
  children,
  confirmTone = 'destructive',
}: DeleteConfirmationModalProps) {
  return (
    <CenteredModal
      visible={visible}
      title={title}
      onClose={onCancel}
      testID={testID}
    >
      <DeleteConfirmationModalContent
        message={message}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        focusCancel={focusCancel}
        requireCountdown={requireCountdown}
        countdownDuration={countdownDuration}
        showCloudDeleteOption={showCloudDeleteOption}
        cloudDeleteLabel={cloudDeleteLabel}
        onConfirm={onConfirm}
        onCancel={onCancel}
        confirmTone={confirmTone}
      >
        {children}
      </DeleteConfirmationModalContent>
    </CenteredModal>
  );
}

const styles = StyleSheet.create({
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
});
