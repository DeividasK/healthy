import React, { useState } from 'react';
import { Alert, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Plus, Trash2, X } from 'lucide-react-native';
import { ResourceActionDock, type DockAction } from './ResourceActionDock';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';

export function FormActionDock({
  onAdd,
  addDisabled = false,
  addExpanded = false,
  addTestID = 'add-option-button',
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
  onAdd?: () => void;
  addDisabled?: boolean;
  addExpanded?: boolean;
  addTestID?: string;
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
  else if (showCancel && !onAdd) actions.push(cancelAction);
  actions.push({
    label: isSaving ? 'Saving...' : saveLabel,
    testID: saveTestID,
    icon: Check,
    onPress: onSave,
    primary: !onAdd,
    disabled: isSaving || saveDisabled,
    busy: isSaving,
  });
  if (onAdd)
    actions.push({
      label: 'Add optional fields',
      testID: addTestID,
      icon: Plus,
      onPress: onAdd,
      primary: true,
      disabled: isSaving || addDisabled,
      expanded: addExpanded,
    });
  if ((hasDelete || onAdd) && showCancel) actions.push(cancelAction);
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
              const message = 'Failed to delete. Please try again.';
              if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert(`Error\n${message}`);
              } else {
                Alert.alert('Error', message);
              }
            }
          }}
          onCancel={() => setDeleteVisible(false)}
        />
      )}
    </>
  );
}
