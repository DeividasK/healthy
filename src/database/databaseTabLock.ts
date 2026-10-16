/**
 * Keeps the web database to one tab at a time.
 *
 * expo-sqlite on web stores the database in OPFS through an access handle
 * pool that takes an exclusive handle on every file, so a second tab cannot
 * open it. A failed open also leaves that tab's SQLite worker unusable. Tabs
 * therefore claim a Web Lock before anything opens the database, and hold it
 * until the page unloads. A tab without the lock never touches OPFS.
 *
 * Native platforms (and browsers without Web Locks) own the database outright.
 */

const LOCK_NAME = 'healthy-database';

let owned = false;
let ownedPromise: Promise<void> | null = null;
let resolveOwned: (() => void) | null = null;
let waiting = false;

function getLocks(): LockManager | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.locks ?? null;
}

function holdLock(): Promise<void> {
  owned = true;
  resolveOwned?.();
  // The lock is released when the page unloads.
  return new Promise<void>(() => {});
}

/** Resolves once this tab owns the database. */
export function whenDatabaseTabOwned(): Promise<void> {
  if (owned || !getLocks()) return Promise.resolve();
  ownedPromise ??= new Promise<void>((resolve) => {
    resolveOwned = resolve;
  });
  return ownedPromise;
}

/**
 * Tries to make this tab the database owner. Returns false while another tab
 * holds the database; this tab then takes over by itself once it closes.
 */
export async function claimDatabaseTab(): Promise<boolean> {
  const locks = getLocks();
  if (owned || !locks) return true;
  const acquired = await new Promise<boolean>((resolve) => {
    void locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      resolve(Boolean(lock));
      return lock ? holdLock() : undefined;
    });
  });
  if (!acquired && !waiting) {
    waiting = true;
    void locks.request(LOCK_NAME, () => holdLock());
  }
  return acquired || owned;
}
