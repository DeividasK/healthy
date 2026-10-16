import React, { useState } from 'react';
import { ChevronLeft, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { Alert, Keyboard, Platform } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useActionDock } from './AppChrome';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import type { DockAction } from './ActionDock';
export type { DockAction } from './ActionDock';
export { getActionDockMenuOffset } from './ActionDock';

export interface DeleteConfirmation {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
}

interface ResourceActionDockProps {
  actions?: DockAction[];
  editLabel?: string;
  onEdit?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  editTestID?: string;
  addTestID?: string;
  addMenuExpanded?: boolean;
  showBack?: boolean;
  /** Deletes through a confirmation modal; or pass `onDelete` to handle it. */
  deleteConfirmation?: DeleteConfirmation;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteTestID?: string;
  deleteDisabled?: boolean;
}

/** The screen's island: back, delete, then the screen's own actions. */
export function ResourceActionDock({
  actions,
  editLabel,
  onEdit,
  onAdd,
  addLabel,
  editTestID,
  addTestID,
  addMenuExpanded,
  showBack,
  deleteConfirmation,
  onDelete,
  deleteLabel = 'Delete',
  deleteTestID = 'delete-button',
  deleteDisabled = false,
}: ResourceActionDockProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { patients } = useActivePatient();
  const [deleteVisible, setDeleteVisible] = useState(false);
  const shouldShowBack = showBack ?? (pathname !== '/' && patients.length > 0);
  const resourceActions: DockAction[] = actions ?? [
    ...(onAdd && addLabel && addTestID
      ? [
          {
            label: addLabel,
            testID: addTestID,
            icon: Plus,
            onPress: onAdd,
            primary: true,
            expanded: addMenuExpanded,
          },
        ]
      : []),
    ...(onEdit && editLabel && editTestID
      ? [
          {
            label: editLabel,
            testID: editTestID,
            icon: Pencil,
            onPress: onEdit,
          },
        ]
      : []),
  ];
  const hasDelete = Boolean(onDelete || deleteConfirmation);
  const dockActions: DockAction[] = [
    ...(shouldShowBack
      ? [
          {
            label: 'Go back',
            testID: 'back-button',
            icon: ChevronLeft,
            onPress: () => {
              Keyboard.dismiss();
              if (router.canGoBack()) router.back();
              else router.replace('/');
            },
          },
        ]
      : []),
    ...(hasDelete
      ? [
          {
            label: deleteLabel,
            testID: deleteTestID,
            icon: Trash2,
            onPress: onDelete ?? (() => setDeleteVisible(true)),
            disabled: deleteDisabled,
          },
        ]
      : []),
    ...resourceActions,
  ];
  useActionDock(dockActions);
  if (!deleteConfirmation) return null;
  return (
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
  );
}
