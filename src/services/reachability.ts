import { useSyncExternalStore } from 'react';

// Answers with an empty 204 wherever Google is reachable.
const PROBE_URL = 'https://www.googleapis.com/generate_204';
const PROBE_INTERVAL_MS = 10000;

let unreachable = false;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function setUnreachable(next: boolean): void {
  if (unreachable === next) return;
  unreachable = next;
  if (!next && probeTimer) {
    clearTimeout(probeTimer);
    probeTimer = null;
  }
  listeners.forEach((listener) => listener());
}

async function probe(): Promise<void> {
  probeTimer = null;
  // A request left hanging would otherwise stop the checks for good.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_INTERVAL_MS);
  try {
    // Any response, even an opaque one, means the network got through.
    await fetch(PROBE_URL, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    setUnreachable(false);
  } catch {
    if (unreachable && !probeTimer)
      probeTimer = setTimeout(probe, PROBE_INTERVAL_MS);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Whether a request failed because the network could not be reached:
 * browsers and React Native reject `fetch` with a TypeError then.
 */
export function isNetworkError(err: unknown): boolean {
  return (
    err instanceof TypeError &&
    /Failed to fetch|Load failed|NetworkError|Network request failed/i.test(
      err.message
    )
  );
}

/**
 * Records that a request could not reach the internet although the device
 * reports a connection (e.g. Wi-Fi without internet, or DNS failing), and
 * checks again until it can.
 */
export function reportUnreachable(): void {
  setUnreachable(true);
  if (!probeTimer) probeTimer = setTimeout(probe, PROBE_INTERVAL_MS);
}

/** Records that a request reached the internet. */
export function reportReachable(): void {
  setUnreachable(false);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getUnreachable = () => unreachable;

/** Whether the last request found the internet unreachable. */
export function useIsInternetUnreachable(): boolean {
  return useSyncExternalStore(subscribe, getUnreachable, getUnreachable);
}
