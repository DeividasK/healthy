import { test, expect } from '@playwright/test';
import {
  HlcDriftError,
  MAX_HLC_DRIFT_MS,
  formatHlc,
  nextHlc,
  parseHlc,
  receiveHlc,
} from './hlc';

const device = 'aaaaaaaaaaaaaaaa';

test('formats sortable timestamps and parses them back', () => {
  const hlc = { ms: 1_700_000_000_000, counter: 10, deviceId: device };
  expect(formatHlc(hlc)).toBe(`1700000000000-000a-${device}`);
  expect(parseHlc(formatHlc(hlc))).toEqual(hlc);
  expect(formatHlc({ ...hlc, counter: 11 }) > formatHlc(hlc)).toBe(true);
  expect(
    formatHlc({ ...hlc, ms: hlc.ms + 1, counter: 0 }) > formatHlc(hlc)
  ).toBe(true);
  expect(() => parseHlc('not-a-clock')).toThrow();
});

test('never goes backwards when the wall clock does', () => {
  const first = nextHlc(null, 5_000, device);
  const sameMs = nextHlc(first, 5_000, device);
  const clockWentBack = nextHlc(sameMs, 4_000, device);
  const later = nextHlc(clockWentBack, 6_000, device);
  const ordered = [first, sameMs, clockWentBack, later].map(formatHlc);
  expect([...ordered].sort()).toEqual(ordered);
  expect(new Set(ordered).size).toBe(4);
  expect(later).toEqual({ ms: 6_000, counter: 0, deviceId: device });
});

test('borrows the next millisecond when the counter overflows', () => {
  expect(
    nextHlc({ ms: 9, counter: 0xffff, deviceId: device }, 9, device)
  ).toEqual({ ms: 10, counter: 0, deviceId: device });
});

test('orders local changes after every received timestamp', () => {
  const now = 1_000_000;
  const remote = { ms: now + 60_000, counter: 3, deviceId: 'bbbbbbbbbbbbbbbb' };
  const received = receiveHlc(
    { ms: now, counter: 0, deviceId: device },
    remote,
    now,
    device
  );
  expect(received).toEqual({ ms: remote.ms, counter: 4, deviceId: device });
  expect(formatHlc(nextHlc(received, now, device)) > formatHlc(remote)).toBe(
    true
  );
  // Equal physical times take the larger counter.
  expect(
    receiveHlc(
      { ms: 50, counter: 7, deviceId: device },
      { ...remote, ms: 50 },
      10,
      device
    )
  ).toEqual({ ms: 50, counter: 8, deviceId: device });
});

test('rejects remote clocks too far in the future', () => {
  const now = 1_000_000;
  expect(() =>
    receiveHlc(
      null,
      { ms: now + MAX_HLC_DRIFT_MS + 1, counter: 0, deviceId: 'b' },
      now,
      device
    )
  ).toThrow(HlcDriftError);
});
