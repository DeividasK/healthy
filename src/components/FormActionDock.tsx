import React, { useState } from 'react';
import { Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Trash2, X } from 'lucide-react-native';
import { ResourceActionDock, type DockAction } from './ResourceActionDock';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

export function FormActionDock({
  onSave,
  isSaving = false,
  saveDisabled = false,
  saveLabel = 'Save',
  saveTestID = 'save-button',
  showCancel = true,
  onDelete,
  deleteLabel = 'Delete',
  deleteTestID = 'delete-button',
  deleteConfirmation,
}: {
  onSave: () => void;
  isSaving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  saveTestID?: string;
  showCancel?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteTestID?: string;
  deleteConfirmation?: {
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  };
}) {
  const router = useRouter();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const actions: DockAction[] = [];
  const cancelAction: DockAction = {
    label: 'Cancel',
    testID: 'cancel-button',
    icon: X,
    disabled: isSaving,
    onPress: () => {
      Keyboard.dismiss();
      if (router.canGoBack()) router.back();
      else router.replace('/');
    },
  };
  const hasDelete = Boolean(onDelete || deleteConfirmation);
  if (hasDelete)
    actions.push({
      label: deleteLabel,
      testID: deleteTestID,
      icon: Trash2,
      onPress: onDelete ?? (() => setDeleteVisible(true)),
      disabled: isSaving,
    });
  else if (showCancel) actions.push(cancelAction);
  actions.push({
    label: isSaving ? 'Saving...' : saveLabel,
    testID: saveTestID,
    icon: Check,
    onPress: onSave,
    primary: true,
    disabled: isSaving || saveDisabled,
    busy: isSaving,
  });
  if (hasDelete && showCancel) actions.push(cancelAction);
  return (
    <>
      <ResourceActionDock actions={actions} showBack={false} />
      {deleteConfirmation && (
        <DeleteConfirmationModal
          visible={deleteVisible}
          title={deleteConfirmation.title}
          message={deleteConfirmation.message}
          requireCountdown
          onConfirm={async () => {
            try {
              await deleteConfirmation.onConfirm();
              setDeleteVisible(false);
            } catch (error) {
              console.error('Failed to delete resource:', error);
            }
          }}
          onCancel={() => setDeleteVisible(false)}
        />
      )}
    </>
  );
}
