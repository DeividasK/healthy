import { useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';

/**
 * Open state for suggestions under an input that closes when focus leaves
 * the container. Pass `onBlur` to both the container (web `focusout`) and the
 * input (iOS/Android, where a View emits no blur).
 */
export function useDismissOnBlur() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<View>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    []
  );

  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  };
  const close = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(false);
  };
  const onBlur = (event: any) => {
    // Focus moving onto a suggestion keeps the list open for its press.
    const next = event?.nativeEvent?.relatedTarget ?? event?.relatedTarget;
    if (next && (containerRef.current as any)?.contains?.(next)) return;
    // Delay so a tap on a suggestion lands before the list unmounts.
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setIsOpen(false), 150);
  };

  return { isOpen, open, close, onBlur, containerRef };
}
