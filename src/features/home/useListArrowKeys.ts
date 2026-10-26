import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Up and down arrows move through the biomarker list beside the detail
 * (web), choosing each biomarker they reach, unless a field has the keys.
 * `listID` is the list's native ID, unique per screen since the stack keeps
 * earlier screens in the page.
 */
export function useListArrowKeys(listID: string, enabled: boolean) {
  // Only while this screen is in front: the stack keeps it mounted beneath
  // the screens opened from it.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web' || !enabled) return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select')) return;
        if (document.querySelector('[aria-modal="true"]')) return;
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            `#${listID} [aria-label^="View biomarker:"]`
          ),
        ];
        if (rows.length === 0) return;
        const current = rows.findIndex(
          (row) => row.getAttribute('aria-current') === 'true'
        );
        const next = Math.min(
          rows.length - 1,
          Math.max(0, current + (event.key === 'ArrowDown' ? 1 : -1))
        );
        event.preventDefault();
        // Keeps the chosen row in the middle of the list, so the list
        // scrolls with every step instead of only at its edges.
        rows[next].focus({ preventScroll: true });
        rows[next].scrollIntoView({ block: 'center' });
        rows[next].click();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [listID, enabled])
  );
}
