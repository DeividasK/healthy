import { DarkTheme, DefaultTheme } from 'expo-router';
import { COLORS } from './colors';

export type NavigationTheme = typeof DefaultTheme;

export const NAV_THEME: { light: NavigationTheme; dark: NavigationTheme } = {
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
  dark: {
    ...DarkTheme,
    dark: true,
    colors: {
      ...DarkTheme.colors,
      background: COLORS.dark.background,
      card: COLORS.dark.card,
      text: COLORS.dark.foreground,
      border: COLORS.dark.border,
      primary: COLORS.dark.primary,
      notification: COLORS.dark.destructive,
    },
  },
};
