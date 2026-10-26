import React, { useCallback } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ScreenHeading } from './ScreenHeading';
import { COLORS } from '@/src/theme/colors';
import { WIDE_MAX_WIDTH } from '@/src/theme/layout';

/**
 * Up and down arrows move through a list beside its detail (web), choosing
 * each row they reach, unless a field or dialog has the keys. Rows are the
 * buttons in `#listId` whose accessible name starts with `rowLabel`; the
 * chosen one has `aria-current`.
 */
function useListArrowKeys(listId: string, rowLabel: string) {
  // Only while this screen is in front: the stack keeps it mounted beneath
  // the screens opened from it.
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') return;
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('input, textarea, select')) return;
        if (document.querySelector('[aria-modal="true"]')) return;
        const rows = [
          ...document.querySelectorAll<HTMLElement>(
            `#${listId} [aria-label^="${rowLabel}"]`
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
        rows[next].focus();
        rows[next].click();
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }, [listId, rowLabel])
  );
}

/**
 * Desktop list-and-detail screen: the list stays on the left under the
 * screen's title and the chosen row's details show on the right. Arrow keys
 * move through the list.
 */
export function ListDetailLayout({
  title,
  listId,
  rowLabel,
  testID,
  list,
  detail,
  dock,
}: {
  title: string;
  /** The list's element id, which the arrow keys search for rows. */
  listId: string;
  /** Start of each row's accessible name, e.g. "View biomarker:". */
  rowLabel: string;
  testID: string;
  list: React.ReactNode;
  detail: React.ReactNode;
  /** The screen's action dock, unless the detail brings its own. */
  dock?: React.ReactNode;
}) {
  useListArrowKeys(listId, rowLabel);
  return (
    <View style={styles.split} testID={testID}>
      <ScrollView
        nativeID={listId}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        <ScreenHeading>{title}</ScreenHeading>
        {list}
      </ScrollView>
      <View style={styles.detail}>{detail}</View>
      {dock}
    </View>
  );
}

const styles = StyleSheet.create({
  split: {
    flex: 1,
    flexDirection: 'row',
    width: '100%',
    maxWidth: WIDE_MAX_WIDTH,
    alignSelf: 'center',
  },
  list: {
    width: 440,
    flexGrow: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.light.cardBorder,
  },
  listContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 132 },
  detail: { flex: 1 },
});
