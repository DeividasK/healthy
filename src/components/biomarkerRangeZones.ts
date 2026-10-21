import type { RangeStatus } from '@/src/features/lab-results/biomarkerMeasurements';

export type RangeZone = { status: RangeStatus; width: number };

/**
 * Lays out a range bar: out-of-range zones either side of the reference
 * range, sized to the real values, with the value's position. Widths and
 * positions are percentages of the bar. Returns undefined without a usable
 * bound.
 */
export function getRangeZones(value: number, low?: number, high?: number) {
  if (!Number.isFinite(value) || (low === undefined && high === undefined))
    return undefined;
  if (low !== undefined && high !== undefined && high <= low) return undefined;
  const bound = (low ?? high)!;
  // A one-sided range borrows a span from the value or the bound's size.
  const span =
    low !== undefined && high !== undefined
      ? high - low
      : Math.max(Math.abs(value - bound), Math.abs(bound) * 0.5, 1);
  const lowEdge = low ?? high! - span;
  const highEdge = high ?? low! + span;
  // A range starting at zero has nothing below it to show.
  const min = Math.min(low === 0 ? 0 : lowEdge - span * 0.4, value);
  const max = Math.max(highEdge + span * 0.4, value);
  const position = (v: number) => ((v - min) / (max - min)) * 100;
  const inStart = position(low ?? min);
  const inEnd = position(high ?? max);
  const zones: RangeZone[] = [];
  if (inStart > 0) zones.push({ status: 'outOfRange', width: inStart });
  zones.push({ status: 'inRange', width: inEnd - inStart });
  if (inEnd < 100) zones.push({ status: 'outOfRange', width: 100 - inEnd });
  return {
    zones,
    // Keeps the marker fully on the bar at the extremes.
    marker: Math.min(97, Math.max(3, position(value))),
    limits: [low, high]
      .filter((limit): limit is number => limit !== undefined)
      .map((limit) => ({ value: limit, position: position(limit) })),
  };
}
