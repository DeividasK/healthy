import { Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useActionDock } from './AppChrome';
import type { DockAction } from './ActionDock';
export type { DockAction } from './ActionDock';
export { getActionDockMenuOffset } from './ActionDock';

interface ResourceActionDockProps {
  actions?: DockAction[];
  deleteLabel?: string;
  editLabel?: string;
  onDelete?: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
  addLabel?: string;
  deleteTestID?: string;
  editTestID?: string;
  addTestID?: string;
  addMenuExpanded?: boolean;
}

export function ResourceActionDock({
  actions,
  deleteLabel,
  editLabel,
  onDelete,
  onEdit,
  onAdd,
  addLabel,
  deleteTestID,
  editTestID,
  addTestID,
  addMenuExpanded,
}: ResourceActionDockProps) {
  const dockActions: DockAction[] = actions ?? [
    ...(onDelete && deleteLabel && deleteTestID
      ? [
          {
            label: deleteLabel,
            testID: deleteTestID,
            icon: Trash2,
            onPress: onDelete,
          },
        ]
      : []),
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
  useActionDock(dockActions);
  return null;
}
