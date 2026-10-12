import React from 'react';
import { Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Trash2, X } from 'lucide-react-native';
import { ResourceActionDock, type DockAction } from './ResourceActionDock';

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
}) {
  const router = useRouter();
  const actions: DockAction[] = [];
  if (showCancel)
    actions.push({
      label: 'Cancel',
      testID: 'cancel-button',
      icon: X,
      disabled: isSaving,
      onPress: () => {
        Keyboard.dismiss();
        if (router.canGoBack()) router.back();
        else router.replace('/');
      },
    });
  actions.push({
    label: isSaving ? 'Saving...' : saveLabel,
    testID: saveTestID,
    icon: Check,
    onPress: onSave,
    primary: true,
    disabled: isSaving || saveDisabled,
    busy: isSaving,
  });
  if (onDelete)
    actions.push({
      label: deleteLabel,
      testID: deleteTestID,
      icon: Trash2,
      onPress: onDelete,
      disabled: isSaving,
    });
  return <ResourceActionDock actions={actions} />;
}
