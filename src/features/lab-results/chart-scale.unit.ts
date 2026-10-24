import { test, expect } from '@playwright/test';
import { getChartScale } from './chartScale';

/** Grid squares from the bottom of the chart to a value. */
const squaresTo = (value: number, { min, max }: { min: number; max: number }) =>
  ((value - min) / (max - min)) * 9;

test.describe('Chart scale', () => {
  test('puts both reference limits on grid lines', () => {
    const scale = getChartScale([4.5, 4.8], 9, 3.92, 5.65);
    for (const limit of [3.92, 5.65]) {
      const squares = squaresTo(limit, scale);
      expect(squares).toBeCloseTo(Math.round(squares), 9);
    }
    // The range takes up most of the chart, with a square either side.
    expect(squaresTo(3.92, scale)).toBeCloseTo(1, 9);
    expect(squaresTo(5.65, scale)).toBeCloseTo(8, 9);
  });

  test('fits values outside the range, with room for the top label', () => {
    const scale = getChartScale([2, 12], 9, 4, 6);
    expect(scale.min).toBeLessThanOrEqual(2);
    expect(squaresTo(12, scale)).toBeLessThanOrEqual(8);
    for (const limit of [4, 6]) {
      const squares = squaresTo(limit, scale);
      expect(squares).toBeCloseTo(Math.round(squares), 9);
    }
  });

  test('keeps the axis at or above zero for values that cannot be negative', () => {
    const scale = getChartScale([0.3, 0.4], 9, 0.1, 0.5);
    expect(scale.min).toBeGreaterThanOrEqual(-1e-9);
    expect(scale.min).toBeLessThanOrEqual(0.3);
  });

  test('puts a one-sided limit on a grid line', () => {
    const scale = getChartScale([80, 140, 95], 9, undefined, 100);
    const squares = squaresTo(100, scale);
    expect(squares).toBeCloseTo(Math.round(squares), 9);
    expect(scale.min).toBeLessThan(80);
    expect(scale.max).toBeGreaterThan(140);
  });

  test('spreads values without a range', () => {
    const scale = getChartScale([5, 5], 9);
    expect(scale.min).toBeLessThan(5);
    expect(scale.max).toBeGreaterThan(5);
  });
});
