import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeading } from './ScreenHeading';
import { useListArrowKeys } from './useListArrowKeys';
import { COLORS } from '@/src/theme/colors';
import { WIDE_MAX_WIDTH } from '@/src/theme/layout';

/**
 * Desktop list-and-detail screen: the list stays on the left under the
 * screen's title and the chosen row's details show on the right. Arrow keys
 * move through the list.
 */
export function ListDetailLayout({
  title,
  listId,
  rowSelector,
  testID,
  list,
  detail,
  dock,
}: {
  title: string;
  /** The list's element id, which the arrow keys search for rows. */
  listId: string;
  /** CSS selector of the list's rows, e.g. `[aria-label^="View biomarker:"]`. */
  rowSelector: string;
  testID: string;
  list: React.ReactNode;
  detail: React.ReactNode;
  /** The screen's action dock, unless the detail brings its own. */
  dock?: React.ReactNode;
}) {
  useListArrowKeys(listId, rowSelector);
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
