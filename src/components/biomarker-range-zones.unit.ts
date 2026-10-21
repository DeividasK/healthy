import { test, expect } from '@playwright/test';
import { getRangeZones } from './biomarkerRangeZones';

const widths = (value: number, low?: number, high?: number) =>
  getRangeZones(value, low, high)!.zones.map(({ status, width }) => [
    status,
    Math.round(width),
  ]);

test('sizes zones to the reference range and places the value in proportion', () => {
  const layout = getRangeZones(15.5, 13.5, 17.5)!;
  expect(widths(15.5, 13.5, 17.5)).toEqual([
    ['outOfRange', 22],
    ['inRange', 56],
    ['outOfRange', 22],
  ]);
  expect(layout.marker).toBeCloseTo(50);
  expect(layout.limits.map(({ value }) => value)).toEqual([13.5, 17.5]);
  expect(layout.limits[0].position).toBeCloseTo(22.2, 1);
});

test('stretches the scale to values far outside the range', () => {
  const layout = getRangeZones(30, 13.5, 17.5)!;
  expect(layout.marker).toBe(97);
  const total = layout.zones.reduce((sum, { width }) => sum + width, 0);
  expect(total).toBeCloseTo(100);
  expect(getRangeZones(-50, 13.5, 17.5)!.marker).toBe(3);
});

test('handles one-sided ranges, ranges from zero and unusable bounds', () => {
  expect(widths(1, 0, 3).map(([status]) => status)).toEqual([
    'inRange',
    'outOfRange',
  ]);
  expect(widths(5, 4).map(([status]) => status)).toEqual([
    'outOfRange',
    'inRange',
  ]);
  expect(widths(5, undefined, 4).map(([status]) => status)).toEqual([
    'inRange',
    'outOfRange',
  ]);
  expect(getRangeZones(5)).toBeUndefined();
  expect(getRangeZones(5, 6, 4)).toBeUndefined();
  expect(getRangeZones(NaN, 1, 2)).toBeUndefined();
});
