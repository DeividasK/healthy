// Healthy's offline service worker. Keeps the app shell and its hashed
// bundles cached so the installed web app opens without a connection.
// Health data never passes through here: it lives in the local database.
const SCOPE = new URL(self.registration.scope);
// Each deployment on the origin (/a, and the latest build under /i) keeps its
// own cache, so updating one never deletes the other's. The released app's
// cache keeps the name it always had.
const SUFFIX = SCOPE.pathname.endsWith('/i/') ? '@i' : '';
const CACHE = 'healthy-shell-v1' + SUFFIX;
const isOwnCache = (key) =>
  SUFFIX ? key.endsWith(SUFFIX) : !key.includes('@');
const INDEX = new URL('index.html', SCOPE).href;

/**
 * Browsers refuse a redirected response for a page load, and hosts may
 * redirect `index.html`, so the shell is stored as a plain copy.
 */
async function shellCopy(response) {
  return new Response(await response.blob(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/** The shell plus every script, stylesheet and icon it links to. */
async function precacheShell() {
  const cache = await caches.open(CACHE);
  const response = await fetch(INDEX, { cache: 'no-cache' });
  if (!response.ok) return;
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(([, href]) => new URL(href, SCOPE))
    .filter((url) => url.origin === SCOPE.origin)
    .map((url) => url.href);
  await cache.put(INDEX, await shellCopy(response));
  await cache.addAll([...new Set(assets)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && isOwnCache(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== SCOPE.origin) return;
  // Google's sign-in callback is not the app shell and must not replace it.
  if (url.pathname.endsWith('/oauth-callback.html')) return;

  // Pages: the network's latest shell, the cached one when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches
              .open(CACHE)
              .then(async (cache) => cache.put(INDEX, await shellCopy(copy)));
          }
          return response;
        })
        .catch(() => caches.match(INDEX))
    );
    return;
  }

  // Bundles and assets: hashed, so a cached copy is always current.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
    )
  );
});
