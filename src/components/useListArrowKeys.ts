import { useCallback } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

const CLOSED_GROUP =
  '[data-testid*="-groups-"][data-testid$="-toggle"][aria-expanded="false"]';

// Keeps the chosen row in the middle of the list, so the list scrolls with
// every step instead of only at its edges.
function choose(row: HTMLElement) {
  row.focus({ preventScroll: true });
  row.scrollIntoView({ block: 'center' });
  row.click();
}

/**
 * Up and down arrows move through a list beside its detail (web), choosing
 * each row they reach and opening collapsed status groups on the way,
 * unless a field or dialog has the keys. Rows are the elements in `#listId`
 * matching the `row` selector; the chosen one has `aria-current`. The list ID is unique per screen, since the stack keeps
 * earlier screens in the page.
 */
export function useListArrowKeys(listId: string, row: string, enabled = true) {
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
        const items = [
          ...document.querySelectorAll<HTMLElement>(
            `#${listId} ${row}, #${listId} ${CLOSED_GROUP}`
          ),
        ];
        if (items.length === 0) return;
        event.preventDefault();
        const current = items.findIndex(
          (item) => item.getAttribute('aria-current') === 'true'
        );
        const down = event.key === 'ArrowDown';
        // With no row chosen yet, the first step goes to the top.
        const next =
          current === -1 ? items[0] : items[current + (down ? 1 : -1)];
        if (!next) return;
        if (next.matches(row)) return choose(next);
        // A collapsed group in the way opens, and the step lands on its
        // nearest row.
        next.click();
        requestAnimationFrame(() => {
          const opened = next.parentElement?.querySelectorAll<HTMLElement>(row);
          if (opened?.length)
            choose(down ? opened[0] : opened[opened.length - 1]);
        });
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [listId, row, enabled])
  );
}
