/**
 * Hybrid Logical Clock (HLC) timestamps for ordering sync changes.
 *
 * A timestamp is `<ms:13 digits>-<counter:4 hex>-<deviceId>`, so plain string
 * comparison orders changes by physical time, then counter, then device. The
 * clock never goes backwards and tolerates device clock skew: a device that
 * receives a change from the future continues counting after it.
 */
export interface Hlc {
  ms: number;
  counter: number;
  deviceId: string;
}

/** Remote clocks further ahead than this are rejected as corrupt. */
export const MAX_HLC_DRIFT_MS = 24 * 60 * 60 * 1000;
const MAX_COUNTER = 0xffff;

export class HlcDriftError extends Error {
  constructor(remote: string) {
    super(`Rejected a change timestamped too far in the future: ${remote}`);
    this.name = 'HlcDriftError';
  }
}

export function formatHlc({ ms, counter, deviceId }: Hlc): string {
  return `${String(ms).padStart(13, '0')}-${counter
    .toString(16)
    .padStart(4, '0')}-${deviceId}`;
}

export function parseHlc(value: string): Hlc {
  const match = /^(\d{13})-([0-9a-f]{4})-([0-9a-z]+)$/.exec(value);
  if (!match) throw new Error(`Invalid HLC timestamp: ${value}`);
  return {
    ms: Number(match[1]),
    counter: parseInt(match[2], 16),
    deviceId: match[3],
  };
}

function bump(ms: number, counter: number, deviceId: string): Hlc {
  // Overflowing the counter borrows the next millisecond instead of wrapping.
  return counter > MAX_COUNTER
    ? { ms: ms + 1, counter: 0, deviceId }
    : { ms, counter, deviceId };
}

/** Returns the timestamp for a local change made at `physicalMs`. */
export function nextHlc(
  last: Hlc | null,
  physicalMs: number,
  deviceId: string
): Hlc {
  if (!last || physicalMs > last.ms)
    return { ms: physicalMs, counter: 0, deviceId };
  return bump(last.ms, last.counter + 1, deviceId);
}

/**
 * Advances the local clock past a received timestamp so later local changes
 * always order after everything this device has seen.
 */
export function receiveHlc(
  last: Hlc | null,
  remote: Hlc,
  nowMs: number,
  deviceId: string
): Hlc {
  if (remote.ms - nowMs > MAX_HLC_DRIFT_MS)
    throw new HlcDriftError(formatHlc(remote));
  const lastMs = last?.ms ?? 0;
  const ms = Math.max(lastMs, remote.ms, nowMs);
  if (ms === lastMs && ms === remote.ms)
    return bump(ms, Math.max(last?.counter ?? 0, remote.counter) + 1, deviceId);
  if (ms === lastMs) return bump(ms, (last?.counter ?? 0) + 1, deviceId);
  if (ms === remote.ms) return bump(ms, remote.counter + 1, deviceId);
  return { ms, counter: 0, deviceId };
}
