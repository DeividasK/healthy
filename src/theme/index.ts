import { DefaultTheme } from 'expo-router';
import { COLORS } from './colors';

export type NavigationTheme = typeof DefaultTheme;

export const NAV_THEME: { light: NavigationTheme } = {
  light: {
    ...DefaultTheme,
    dark: false,
    colors: {
      ...DefaultTheme.colors,
      background: COLORS.light.background,
      card: COLORS.light.card,
      text: COLORS.light.foreground,
      border: COLORS.light.border,
      primary: COLORS.light.primary,
      notification: COLORS.light.destructive,
    },
  },
};
