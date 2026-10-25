import { useWindowDimensions } from 'react-native';

/**
 * The column every screen's content sits in. Phones fill it edge to edge;
 * wider windows centre it, so lines and rows stay a readable length.
 */
export const CONTENT_COLUMN = {
  width: '100%',
  maxWidth: 800,
  alignSelf: 'center',
} as const;

/** The column of screens that lay out side by side on desktop. */
export const WIDE_MAX_WIDTH = 1240;

/**
 * Desktop windows: wide enough for the sidebar beside two columns of rows.
 * Narrower windows, tablets and phones keep the header and one column.
 */
export const useIsWideLayout = () => useWindowDimensions().width >= 1200;
