import { useEffect, useLayoutEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

// Escape (web) and the back button or gesture (Android) go only to the most
// recently registered handler, so an open menu or dialog closes before the
// screen underneath reacts.
const handlers: { current: () => void }[] = [];

const onKeyDown = (event: KeyboardEvent) => {
  const handler = handlers[handlers.length - 1];
  if (event.key !== 'Escape' || !handler) return;
  event.preventDefault();
  event.stopPropagation();
  handler.current();
};

const onBackPress = () => {
  const handler = handlers[handlers.length - 1];
  if (!handler) return false;
  handler.current();
  return true;
};

/** Runs `handler` on Escape (web) or back (Android) while `enabled`. */
export function useDismissKey(handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Registered before the screen paints, so a key pressed as soon as it
  // shows is not lost.
  useLayoutEffect(() => {
    if (!enabled) return;
    if (Platform.OS === 'android') {
      handlers.push(handlerRef);
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress
      );
      return () => {
        handlers.splice(handlers.indexOf(handlerRef), 1);
        subscription.remove();
      };
    }
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!handlers.length) document.addEventListener('keydown', onKeyDown, true);
    handlers.push(handlerRef);
    return () => {
      handlers.splice(handlers.indexOf(handlerRef), 1);
      if (!handlers.length)
        document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [enabled]);
}
