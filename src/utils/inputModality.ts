import { Platform } from 'react-native';

let lastInput: 'keyboard' | 'pointer' = 'pointer';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', () => (lastInput = 'keyboard'), true);
  document.addEventListener('pointerdown', () => (lastInput = 'pointer'), true);
}

/** Whether the user's most recent interaction on web was the keyboard. */
export function isKeyboardInput() {
  return lastInput === 'keyboard';
}
