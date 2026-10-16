import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Escape goes only to the most recently registered handler, so an open menu
// or dialog closes before the screen underneath reacts.
const handlers: { current: () => void }[] = [];

const onKeyDown = (event: KeyboardEvent) => {
  const handler = handlers[handlers.length - 1];
  if (event.key !== 'Escape' || !handler) return;
  event.preventDefault();
  event.stopPropagation();
  handler.current();
};

/** Runs `handler` on Escape (web only) while `enabled`. */
export function useEscapeKey(handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled || Platform.OS !== 'web' || typeof document === 'undefined')
      return;
    if (!handlers.length) document.addEventListener('keydown', onKeyDown, true);
    handlers.push(handlerRef);
    return () => {
      handlers.splice(handlers.indexOf(handlerRef), 1);
      if (!handlers.length)
        document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [enabled]);
}
