import { COLORS } from '@/src/theme/colors';

const BASE_URL = process.env.EXPO_BASE_URL ?? '';

function appendToHead(tag: string, attributes: Record<string, string>): void {
  const element = document.createElement(tag);
  Object.entries(attributes).forEach(([name, value]) =>
    element.setAttribute(name, value)
  );
  document.head.appendChild(element);
}

/**
 * Makes the web app installable: links the manifest and home-screen icon and,
 * in production builds, registers the service worker that caches the app
 * shell for offline use. The single-page export ignores `app/+html.tsx`, so
 * these are added at runtime with the deployment's base URL.
 */
export function registerPwa(): void {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[rel="manifest"]')) return;

  appendToHead('link', { rel: 'manifest', href: `${BASE_URL}/manifest.json` });
  appendToHead('link', {
    rel: 'apple-touch-icon',
    href: `${BASE_URL}/icons/apple-touch-icon.png`,
  });
  appendToHead('meta', {
    name: 'theme-color',
    content: COLORS.light.card,
  });

  // The dev server rebuilds bundles constantly; caching them would serve stale code.
  if (__DEV__ || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker
    .register(`${BASE_URL}/sw.js`, { scope: `${BASE_URL}/` })
    .catch((error) => console.warn('Offline support is unavailable:', error));
}
