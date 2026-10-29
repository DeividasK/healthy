import React, { createContext, useContext, useRef, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { Check, ChevronLeft, Plus } from 'lucide-react-native';
import { useDismissKey } from '@/src/utils/dismissKey';
import {
  ResourceActionDock,
  type DeleteConfirmation,
  type DockAction,
} from './ResourceActionDock';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { COLORS } from '@/src/theme/colors';

/** What a form shown inside another screen lets that screen do. */
export interface InlineForm {
  save: () => void;
  hasChanges: boolean;
}

/**
 * Shows a form's buttons inside it instead of in the screen's dock, for a
 * form beside a list. The screen keeps its own dock, is told how to save the
 * form (e.g. before another row opens), and where the form's + menu opens.
 */
export const InlineFormContext = createContext<{
  bind: (form: InlineForm) => void;
  /** The + button's place in the window, which its menu opens above. */
  placeMenu: (add: { x: number; y: number; width: number }) => void;
} | null>(null);

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
  secondaryActions = [],
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
  /** Form-specific buttons shown after the `+`, disabled while saving. */
  secondaryActions?: DockAction[];
}) {
  const router = useRouter();
  const isFocused = useIsFocused();
  const inline = useContext(InlineFormContext);
  inline?.bind({ save: onSave, hasChanges });
  const addRef = useRef<View>(null);
  const placeMenu = () =>
    addRef.current?.measureInWindow((x, y, width) =>
      inline?.placeMenu({ x, y, width })
    );
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
  useDismissKey(
    () => {
      if (discardVisible) setDiscardVisible(false);
      else cancel();
    },
    showCancel && isFocused && !isSaving && !inline
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
    // Not while asking whether to discard (Cmd/Ctrl+Enter would save).
    disabled: isSaving || saveDisabled || discardVisible,
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
  for (const action of secondaryActions)
    actions.push({ ...action, disabled: isSaving || action.disabled });
  // Leaving is the screen's job, so an inline form has no Cancel.
  if (inline)
    return (
      <View style={styles.inline}>
        {actions
          .filter((action) => action.testID !== 'cancel-button')
          // Save sits on the right, after the form's other buttons.
          .sort(
            (a, b) => Number(Boolean(a.primary)) - Number(Boolean(b.primary))
          )
          .map(({ label, testID, icon: Icon, onPress, disabled, primary }) => (
            <TouchableOpacity
              key={testID}
              ref={testID === addTestID ? addRef : undefined}
              onLayout={testID === addTestID ? placeMenu : undefined}
              accessibilityRole="button"
              testID={testID}
              disabled={disabled}
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.button,
                primary && styles.primary,
                disabled && styles.disabled,
              ]}
            >
              {Icon && (
                <Icon
                  size={16}
                  color={
                    primary
                      ? COLORS.light.primaryForeground
                      : COLORS.light.foreground
                  }
                />
              )}
              <Text style={[styles.label, primary && styles.primaryLabel]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
      </View>
    );
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

const styles = StyleSheet.create({
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    // Clears the screen's dock, which floats over the bottom of the pane.
    paddingBottom: 100,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.light.cardBorder,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
  },
  primary: {
    backgroundColor: COLORS.light.primary,
    borderColor: COLORS.light.primary,
    marginLeft: 'auto',
  },
  disabled: { opacity: 0.5 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.light.foreground },
  primaryLabel: { color: COLORS.light.primaryForeground },
});
