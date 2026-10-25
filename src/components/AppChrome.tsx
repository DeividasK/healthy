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
import { AppSidebar } from './AppSidebar';
import { KeyboardShortcutsProvider } from './KeyboardShortcuts';
import { useActivePatient } from '@/src/features/profile/ActivePatientContext';
import { COLORS } from '@/src/theme/colors';
import { useIsWideLayout } from '@/src/theme/layout';

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
  const isWide = useIsWideLayout();
  // The sidebar navigates between a profile's sections, so it waits for one.
  const { activePatient } = useActivePatient();
  const showSidebar = isWide && Boolean(activePatient);
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

  // Menus and the dock centre on the content beside the sidebar.
  const overlayLayer = (
    <>
      {Object.entries(overlays).map(([id, content]) => (
        <React.Fragment key={id}>{content}</React.Fragment>
      ))}
      <ActionDock actions={dock?.actions ?? []} enabled={dock?.active} />
    </>
  );

  return (
    <OverlayContext.Provider value={context}>
      <KeyboardShortcutsProvider enabled={showSidebar}>
        <DockMenuAnchorContext.Provider value={menuAnchor}>
          <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* The screens keep their place in the tree in both layouts, so
              resizing the window never remounts them. */}
            <View style={styles.container}>
              {!showSidebar && <AppHeader />}
              <View style={styles.main}>
                {showSidebar && <AppSidebar />}
                <View style={styles.container}>
                  {children}
                  {showSidebar && overlayLayer}
                </View>
              </View>
              {!showSidebar && overlayLayer}
            </View>
          </KeyboardAvoidingView>
        </DockMenuAnchorContext.Provider>
      </KeyboardShortcutsProvider>
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
  main: { flex: 1, flexDirection: 'row' },
});
