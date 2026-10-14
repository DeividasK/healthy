import React, { useState } from 'react';
import { Keyboard } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { Check, ChevronLeft, Plus } from 'lucide-react-native';
import { useEscapeKey } from '@/src/utils/escapeKey';
import {
  ResourceActionDock,
  type DeleteConfirmation,
  type DockAction,
} from './ResourceActionDock';
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
  hasChanges = false,
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
  deleteConfirmation?: DeleteConfirmation;
  /** Entered values would be lost, so cancelling asks to confirm first. */
  hasChanges?: boolean;
}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [discardVisible, setDiscardVisible] = useState(false);
  const leave = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const cancel = () => {
    if (hasChanges) setDiscardVisible(true);
    else leave();
  };
  useEscapeKey(
    () => {
      if (discardVisible) setDiscardVisible(false);
      else cancel();
    },
    showCancel && isFocused && !isSaving
  );
  const actions: DockAction[] = [];
  if (showCancel)
    actions.push({
      label: 'Cancel',
      testID: 'cancel-button',
      icon: ChevronLeft,
      disabled: isSaving,
      onPress: cancel,
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
  if (onAdd)
    actions.push({
      label: 'Add optional fields',
      testID: addTestID,
      icon: Plus,
      onPress: onAdd,
      disabled: isSaving || addDisabled,
      expanded: addExpanded,
    });
  return (
    <>
      <ResourceActionDock
        actions={actions}
        showBack={false}
        onDelete={onDelete}
        deleteConfirmation={deleteConfirmation}
        deleteLabel={deleteLabel}
        deleteTestID={deleteTestID}
        deleteDisabled={isSaving}
      />
      <DeleteConfirmationModal
        visible={discardVisible}
        testID="discard-changes-modal"
        title="Are you sure?"
        message="You'll lose the data you entered."
        cancelLabel="No"
        confirmLabel="Yes"
        focusCancel
        requireCountdown={false}
        onConfirm={() => {
          setDiscardVisible(false);
          leave();
        }}
        onCancel={() => setDiscardVisible(false)}
      />
    </>
  );
}
