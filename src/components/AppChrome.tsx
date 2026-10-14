import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from './AppHeader';
import { ActionDock, getActionDockLayout, type DockAction } from './ActionDock';
import { COLORS } from '@/src/theme/colors';

const OverlayContext = createContext<{
  setOverlay: (id: string, content: React.ReactNode) => void;
  removeOverlay: (id: string) => void;
  setDock: (id: string, actions: DockAction[]) => void;
  removeDock: (id: string) => void;
} | null>(null);

/** Horizontal offset from the screen center of the island's menu toggle. */
const DockMenuAnchorContext = createContext(0);
export const useDockMenuAnchor = () => useContext(DockMenuAnchorContext);

/** Keeps navigation chrome mounted while screens change. */
export function AppChrome({ children }: { children: React.ReactNode }) {
  const [overlays, setOverlays] = useState<Record<string, React.ReactNode>>({});
  const [dock, setActiveDock] = useState<{
    id: string;
    actions: DockAction[];
    active: boolean;
  } | null>(null);
  const setDock = useCallback(
    (id: string, actions: DockAction[]) =>
      setActiveDock({ id, actions, active: true }),
    []
  );
  const removeDock = useCallback(
    (id: string) =>
      // Retain the outgoing geometry while the next screen loads its actions.
      setActiveDock((current) =>
        current?.id === id ? { ...current, active: false } : current
      ),
    []
  );
  const setOverlay = useCallback((id: string, content: React.ReactNode) => {
    setOverlays((current) => ({ ...current, [id]: content }));
  }, []);
  const removeOverlay = useCallback((id: string) => {
    setOverlays((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  const menuAnchor = useMemo(() => {
    const actions = dock?.actions ?? [];
    const index = actions.findIndex((action) => action.expanded !== undefined);
    return index < 0 ? 0 : getActionDockLayout(actions).offsets[index];
  }, [dock?.actions]);
  const context = useMemo(
    () => ({ setOverlay, removeOverlay, setDock, removeDock }),
    [setOverlay, removeOverlay, setDock, removeDock]
  );

  return (
    <OverlayContext.Provider value={context}>
      <DockMenuAnchorContext.Provider value={menuAnchor}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.container}>
            <AppHeader />
            <View style={styles.container}>{children}</View>
            {Object.entries(overlays).map(([id, content]) => (
              <React.Fragment key={id}>{content}</React.Fragment>
            ))}
            <ActionDock actions={dock?.actions ?? []} enabled={dock?.active} />
          </View>
        </KeyboardAvoidingView>
      </DockMenuAnchorContext.Provider>
    </OverlayContext.Provider>
  );
}

export function useActionDock(actions: DockAction[]) {
  const context = useContext(OverlayContext);
  const id = useId();
  if (!context)
    throw new Error('Action docks must be rendered inside AppChrome');
  const { setDock, removeDock } = context;
  useFocusEffect(
    useCallback(() => {
      setDock(id, actions);
      return () => removeDock(id);
    }, [id, actions, setDock, removeDock])
  );
}

/** Places the focused screen's menus and dock above the shared header/content. */
export function AppOverlay({ children }: { children: React.ReactNode }) {
  const context = useContext(OverlayContext);
  const id = useId();
  if (!context) throw new Error('AppOverlay must be rendered inside AppChrome');
  const { setOverlay, removeOverlay } = context;
  useFocusEffect(
    useCallback(() => {
      setOverlay(id, children);
      return () => removeOverlay(id);
    }, [children, id, setOverlay, removeOverlay])
  );
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.light.background },
});
