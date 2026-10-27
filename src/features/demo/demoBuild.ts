/**
 * The demo build at usehealthy.app/d sets EXPO_PUBLIC_DEMO_BUILD. It keeps
 * its database in memory, so it never shares the released app's records or
 * its one-tab database lock, and opens straight into the demo profile.
 * Every visit starts afresh.
 *
 * Development builds can turn it on for one tab through session storage, so
 * E2E tests cover the demo build without a separate dev server.
 */
export const DEMO_BUILD_SESSION_KEY = 'healthy-demo-build';

function demoBuildInSession(): boolean {
  if (typeof sessionStorage === 'undefined' || !__DEV__) return false;
  try {
    return sessionStorage.getItem(DEMO_BUILD_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export const IS_DEMO_BUILD =
  process.env.EXPO_PUBLIC_DEMO_BUILD === '1' || demoBuildInSession();

/**
 * The Pages deploy opens the demo build with `?snapshot=export` to make the
 * ready-made demo: it then creates the demo afresh and hands over its
 * database instead of loading the snapshot.
 */
export const IS_DEMO_SNAPSHOT_EXPORT =
  IS_DEMO_BUILD &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('snapshot') === 'export';
