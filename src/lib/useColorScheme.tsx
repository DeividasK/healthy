import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import { COLORS } from '../theme/colors';

export function useColorScheme() {
  const { colorScheme, setColorScheme } = useNativewindColorScheme();

  function toggleColorScheme() {
    return setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  }

  const activeScheme = colorScheme ?? 'light';

  return {
    colorScheme: activeScheme,
    isDarkColorScheme: activeScheme === 'dark',
    setColorScheme,
    toggleColorScheme,
    colors: COLORS[activeScheme],
  };
}
