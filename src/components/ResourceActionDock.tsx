import { ChevronLeft, Pencil, Plus } from 'lucide-react-native';
import { Keyboard } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { useActionDock } from './AppChrome';
import type { DockAction } from './ActionDock';
export type { DockAction } from './ActionDock';
export { getActionDockMenuOffset } from './ActionDock';

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
}

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
}: ResourceActionDockProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { patients } = useActivePatient();
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
    ...resourceActions,
  ];
  useActionDock(dockActions);
  return null;
}
