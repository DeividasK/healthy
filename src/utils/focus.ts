/**
 * Focuses a web element once it can take focus. Elements that are still
 * entering (e.g. mid-animation or in a modal being shown) briefly refuse
 * focus, so this retries on the next frames until focus lands.
 */
export function focusWhenReady(element: HTMLElement | null | undefined) {
  if (!element || typeof document === 'undefined') return;
  let attempts = 0;
  const tryFocus = () => {
    if (!element.isConnected || document.activeElement === element) return;
    element.focus();
    if (document.activeElement !== element && ++attempts < 30)
      requestAnimationFrame(tryFocus);
  };
  requestAnimationFrame(tryFocus);
}
