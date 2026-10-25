import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Keyboard as KeyboardIcon } from 'lucide-react-native';
import { CenteredModal } from './CenteredModal';
import { COLORS } from '@/src/theme/colors';

/** Sections reached with G, then the section's key. */
const GO_TO: Record<string, { href: Href; label: string }> = {
  h: { href: '/', label: 'Go to Home' },
  j: { href: '/journal', label: 'Go to the journal' },
  b: { href: '/labs-summary', label: 'Go to biomarkers' },
  s: { href: '/settings', label: 'Go to settings' },
};
const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['L'], action: 'Add lab results' },
  { keys: ['/'], action: 'Search biomarkers' },
  ...Object.entries(GO_TO).map(([key, { label }]) => ({
    keys: ['G', key.toUpperCase()],
    action: label,
  })),
  { keys: ['Esc'], action: 'Close a dialog or menu' },
  { keys: ['?'], action: 'Show keyboard shortcuts' },
];
/** How long G waits for the section's key. */
const SEQUENCE_MS = 1500;

const ShowShortcutsContext = createContext<() => void>(() => {});
export const useShowKeyboardShortcuts = () => useContext(ShowShortcutsContext);

/** Whether a key press belongs to a field, a dialog or a browser shortcut. */
function isTaken(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable="true"]'))
    return true;
  return document.querySelector('[aria-modal="true"]') !== null;
}

/**
 * Single-key shortcuts on desktop (web), listed in a dialog that ? or the
 * sidebar opens. Keys typed into fields or dialogs are left alone.
 */
export function KeyboardShortcutsProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const show = useCallback(() => setVisible(true), []);
  const pendingGo = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTaken(event)) return;
      const key = event.key.toLowerCase();
      const go = Date.now() - pendingGo.current < SEQUENCE_MS && GO_TO[key];
      pendingGo.current = 0;
      if (go) {
        event.preventDefault();
        if (go.href === '/') router.dismissTo('/');
        else router.navigate(go.href);
      } else if (key === 'g') {
        pendingGo.current = Date.now();
      } else if (key === '?') {
        event.preventDefault();
        setVisible(true);
      } else if (key === 'l') {
        event.preventDefault();
        router.push('/lab-result/add');
      } else if (key === '/') {
        event.preventDefault();
        if (pathname === '/labs-summary')
          document.getElementById('labs-summary-search')?.focus();
        else
          router.navigate({
            pathname: '/labs-summary',
            params: { focus: 'search' },
          });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, router, pathname]);

  return (
    <ShowShortcutsContext.Provider value={show}>
      {children}
      <CenteredModal
        visible={enabled && visible}
        title="Keyboard shortcuts"
        icon={KeyboardIcon}
        onClose={() => setVisible(false)}
        testID="keyboard-shortcuts"
      >
        <View style={styles.list}>
          {SHORTCUTS.map(({ keys, action }) => (
            <View key={action} style={styles.row}>
              <Text style={styles.action}>{action}</Text>
              <View style={styles.keys}>
                {keys.map((key, index) => (
                  <React.Fragment key={key}>
                    {index > 0 && <Text style={styles.then}>then</Text>}
                    <Text style={styles.key}>{key}</Text>
                  </React.Fragment>
                ))}
              </View>
            </View>
          ))}
        </View>
      </CenteredModal>
    </ShowShortcutsContext.Provider>
  );
}

const styles = StyleSheet.create({
  list: { gap: 4, marginTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    gap: 16,
  },
  action: { fontSize: 15, color: COLORS.light.foreground },
  keys: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  then: { fontSize: 13, color: COLORS.light.muted },
  key: {
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.light.border,
    backgroundColor: COLORS.light.card,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.light.foreground,
  },
});
