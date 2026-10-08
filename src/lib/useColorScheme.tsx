import { COLORS } from '@/src/theme/colors';

export function useColorScheme() {
  return {
    colorScheme: 'light' as const,
    isDarkColorScheme: false,
    setColorScheme: () => {},
    toggleColorScheme: () => {},
    colors: COLORS.light,
  };
}
